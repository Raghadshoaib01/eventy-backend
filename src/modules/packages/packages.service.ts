// src/modules/packages/packages.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PaymentMethod, PaymentStatus, Discount, PackageEventBookingStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { DiscountsService } from '../discounts/discounts.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { BookPackageDto } from './dto/book-package.dto';
import { PayPackageBookingDto } from './dto/pay-package-booking.dto';
import {
  PACKAGE_JOIN_TIMEOUT_HOURS,
  PACKAGE_BOOKING_REQUEST_TIMEOUT_HOURS,
  PACKAGE_PAYMENT_TIMEOUT_HOURS,
} from './packages.constants';
import { PackageBookingQueryDto } from './dto/package-booking-query.dto';

/**
 * PackagesService — Provider Packages + Customer Exclusive-package flow
 * (docs/implementation_plan.md).
 *
 * Architectural choices (per implementation_plan.md §6 — Option A):
 *  - One Payment per child Booking. There is NO aggregated package payment.
 *    Payment.bookings remain the truth. `PackageEventBooking.totalAmount` is a
 *    convenience cache of the sum of child booking totals.
 *  - Event.status stays in its existing enum (no PENDING added). A package
 *    booking creates an Event in DRAFT, transitioning to IN_PROGRESS only
 *    when the package booking has reached `tryProgressPackageBooking`'s
 *    "all child bookings paid or terminal" condition.
 *  - `Booking.packageEventBookingId` is the join between a child booking and
 *    its parent PackageEventBooking.
 */
@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
    private readonly discountsService: DiscountsService,
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────

  private async resolveProvider(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });
    if (!user || !user.provider) throw new NotFoundException('Provider not found');
    return user.provider;
  }

  private async getOwnedPackageOrThrow(userId: string, packageId: string) {
    const provider = await this.resolveProvider(userId);
    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, providerId: provider.id },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  private async getPackageEventBookingOrThrow(
    packageEventBookingId: string,
    opts: { providerId?: string; customerId?: string } = {},
  ) {
    const pb = await this.prisma.packageEventBooking.findUnique({
      where: { id: packageEventBookingId },
      include: {
        package: { include: { provider: { include: { user: true } } } },
        customer: true,
        event: true,
        bookings: true,
        payment: true,
      },
    });
    if (!pb) throw new NotFoundException('Package booking not found');

    if (opts.providerId && pb.package.providerId !== opts.providerId) {
      throw new ForbiddenException('Access denied');
    }
    if (opts.customerId && pb.customerId !== opts.customerId) {
      throw new ForbiddenException('Access denied');
    }

    return pb;
  }

  // ════════════════════════════════════════════════════════════════════
  // PROVIDER — package authoring
  // ════════════════════════════════════════════════════════════════════

  /**
   * `POST /api/v1/packages`
   * Creates a DRAFT Package and one `PackageService` row per supplied
   * service. The serviceIds must all belong to the calling provider — in
   * this architecture cross-provider composition is out of scope; each row
   * is therefore born in ACTIVE status, no join-request round-trip.
   */
  // src/modules/packages/packages.service.ts

async createPackage(userId: string, dto: CreatePackageDto) {
  const provider = await this.resolveProvider(userId);
  const serviceIds = [...new Set(dto.services.map((s) => s.serviceId))];

  // 1) جلب كل الخدمات المطلوبة بغض النظر عن المالك
  const services = await this.prisma.service.findMany({
    where: { id: { in: serviceIds }, approvalStatus: 'ACTIVE'
    //, deletedAt: null 
  },
    select: { id: true, providerId: true, isPackaged: true, serviceType: { select: { name: true } } },
  });
  if (services.length !== serviceIds.length) {
    const found = new Set(services.map((s) => s.id));
    const missing = serviceIds.filter((id) => !found.has(id));
    throw new BadRequestException(`Services not found or not active: ${missing.join(', ')}`);
  }

 // 2) يجب أن تكون إحدى الخدمات المُرسلة نفسها Hall مملوكة للمزود الحالي وبـ isPackaged = true
const ownedPackagedHall = services.find(
  (s) => s.providerId === provider.id && s.serviceType.name === 'HALL' && s.isPackaged,
);
if (!ownedPackagedHall) {
  throw new BadRequestException(
    'The package must include your own Hall service with isPackaged=true among the submitted services',
  );
}

  // 3) خدمتين على الأقل
  if (serviceIds.length < 2) {
    throw new BadRequestException('A package requires at least 2 services');
  }

  // 4) عدم وجود Package أخرى بنفس مجموعة الخدمات (لأي مزود)
  const sortedIds = [...serviceIds].sort();
  const candidateDupes = await this.prisma.package.findMany({
    where: { status: { not: 'CANCELLED' }, services: { some: { serviceId: { in: serviceIds } } } },
    include: { services: { select: { serviceId: true } } },
  });
  const hasDuplicateSet = candidateDupes.some((p) => {
    const existingIds = p.services.map((s) => s.serviceId).sort();
    return (
      existingIds.length === sortedIds.length &&
      existingIds.every((id, i) => id === sortedIds[i])
    );
  });
  if (hasDuplicateSet) {
    throw new BadRequestException('A package with the exact same set of services already exists');
  }

  // 5) وقت مشترك بين جميع خدمات الباقة (تقاطع أيام العمل على الأقل)
  const availabilities = await this.prisma.serviceAvailability.findMany({
    where: { serviceId: { in: serviceIds } },
    include: { workingDays: true },
  });
  const dayScopeByService = new Map<string, Set<string>>();
  for (const avail of availabilities) {
    const set = dayScopeByService.get(avail.serviceId) ?? new Set<string>();
    avail.workingDays.forEach((d) => set.add(d.dayOfWeek));
    dayScopeByService.set(avail.serviceId, set);
  }
  const allDaySets = serviceIds.map((id) => dayScopeByService.get(id) ?? new Set<string>());
  const commonDays = [...(allDaySets[0] ?? [])].filter((day) =>
    allDaySets.every((set) => set.has(day)),
  );
  if (commonDays.length === 0) {
    throw new BadRequestException('The selected services have no common available day/time window');
  }

  // 6) الإنشاء + تحديد الحالة حسب المالك
  const packageRow = await this.prisma.$transaction(async (tx) => {
    const created = await tx.package.create({
      data: {
        providerId: provider.id,
        name: dto.name,
        description: dto.description ?? null,
        discountPercentage: dto.discountPercentage ?? 0,
        status: 'DRAFT',
      },
    });

    await tx.packageService.createMany({
      data: services.map((svc) => ({
        packageId: created.id,
        providerId: svc.providerId,
        serviceId: svc.id,
        status: svc.providerId === provider.id ? 'ACTIVE' : 'PENDING_PROVIDER_APPROVAL',
      })),
    });

    return created;
  });

  // 7) إشعار الشركاء (خدماتهم PENDING) بطلب الانضمام
  const partnerServices = services.filter((s) => s.providerId !== provider.id);
  if (partnerServices.length > 0) {
    const partnerProviders = await this.prisma.serviceProvider.findMany({
      where: { id: { in: partnerServices.map((s) => s.providerId) } },
      select: { id: true, userId: true },
    });
    for (const partner of partnerProviders) {
      const svc = partnerServices.find((s) => s.providerId === partner.id);
      this.domainEventBus.packageJoinRequested({
        actorId: userId,
        targetUserId: partner.userId,
        entityId: packageRow.id,
        packageId: packageRow.id,
        packageName: packageRow.name,
        ownerProviderName: provider.businessName,
        serviceName: svc?.serviceType.name,
      });
    }
  }

  return {
    message: partnerServices.length
      ? 'Package created (DRAFT). Join requests sent to partner providers.'
      : 'Package created (DRAFT).',
    data: packageRow,
  };
}

  /**
   * `PATCH /api/v1/packages/:id`
   * Update name/description/discount while the package is DRAFT.
   */
  async updatePackage(userId: string, packageId: string, dto: UpdatePackageDto) {
    const pkg = await this.getOwnedPackageOrThrow(userId, packageId);
    if (pkg.status !== 'DRAFT') {
      throw new BadRequestException(
        `Package can only be edited while DRAFT (current status: ${pkg.status})`,
      );
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.discountPercentage !== undefined && {
          discountPercentage: dto.discountPercentage,
        }),
      },
    });

    return { message: 'Package updated', data: updated };
  }

  /**
   * `GET /api/v1/packages/my-packages`
   */
  async getMyPackages(userId: string) {
    const provider = await this.resolveProvider(userId);
    const packages = await this.prisma.package.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: 'desc' },
      include: {
        services: { include: { service: { include: { serviceType: { select: { name: true } } } } } },
        eventBookings: { select: { id: true, status: true } },
        discounts: { where: { status: 'ACTIVE' } },
      },
    });
    return { message: 'Packages retrieved successfully', data: packages };
  }

  /**
   * `GET /api/v1/packages/:id` — provider view
   */
  async getPackageForProvider(userId: string, packageId: string) {
    await this.getOwnedPackageOrThrow(userId, packageId);
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        services: { include: { service: { include: { serviceType: { select: { name: true } } } } } },
        eventBookings: {
          include: {
            customer: { select: { fullName: true, email: true } },
            event: { select: { name: true, eventDate: true, eventLocation: true } },
            bookings: {
              include: {
                service: { include: { serviceType: { select: { name: true } } } },
                payment: true,
              },
            },
            payment: true,
          },
        },
        discounts: true,
      },
    });
    return { message: 'Package retrieved successfully', data: pkg };
  }


async activatePackage(userId: string, packageId: string) {
  const provider = await this.resolveProvider(userId);
  const pkg = await this.getOwnedPackageOrThrow(userId, packageId);
  if (pkg.status !== 'DRAFT') {
    throw new BadRequestException(
      `Only DRAFT packages can be activated (current status: ${pkg.status})`,
    );
  }

  const activeCount = await this.prisma.packageService.count({
    where: { packageId, status: 'ACTIVE' },
  });
  if (activeCount < 2) {
    throw new BadRequestException(
      'A package needs at least 2 active services before activation',
    );
  }

  const updated = await this.prisma.package.update({
    where: { id: packageId },
    data: { status: 'ACTIVE' },
  });

  await this.discountsService.suspendDiscountsForPackage(packageId);

  const activePartners = await this.prisma.packageService.findMany({
    where: { packageId, status: 'ACTIVE' },
    include: { provider: { include: { user: true } } },
  });
  for (const partner of activePartners) {
    if (partner.providerId === provider.id) continue; // لا نُشعر المالك بنفسه
    this.domainEventBus.packageActivated({
      actorId: userId,
      targetUserId: partner.provider.user.id,
      entityId: packageId,
      packageId,
      packageName: updated.name,
      ownerProviderName: provider.businessName,
    });
  }

  return { message: 'Package activated', data: updated };
}

  // ════════════════════════════════════════════════════════════════════
  // PROVIDER — package join-request inbox (kept thin: this architecture
  // does not support cross-provider composition, so the inbox is empty by
  // design — we still expose the endpoints for forward compatibility).
  // ════════════════════════════════════════════════════════════════════

  /**
   * `GET /api/v1/packages/join-requests/pending`
   */
// src/modules/packages/packages.service.ts

async getPendingJoinRequests(userId: string) {
  const provider = await this.resolveProvider(userId);
  const rows = await this.prisma.packageService.findMany({
    where: { providerId: provider.id, status: 'PENDING_PROVIDER_APPROVAL' },
    include: {
      package: {
        select: {
          id: true,
          name: true,
          description: true,
          discountPercentage: true,
          provider: { select: { businessName: true, user: { select: { fullName: true, profileImage: true } } } },
        },
      },
      service: { select: { id: true, serviceType: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return { message: 'Pending join requests retrieved', data: rows };
}

async getJoinRequestDetails(userId: string, packageId: string) {
  const provider = await this.resolveProvider(userId);
  const row = await this.prisma.packageService.findFirst({
    where: { packageId, providerId: provider.id, status: 'PENDING_PROVIDER_APPROVAL' },
    include: {
      package: {
        include: { provider: { select: { businessName: true, user: { select: { fullName: true, profileImage: true, phoneNumber: true } } } } },
      },
      service: { include: { serviceType: { select: { name: true } } } },
    },
  });
  if (!row) throw new NotFoundException('Join request not found');
  return { message: 'Join request details retrieved', data: row };
}

async acceptJoinRequest(userId: string, packageId: string) {
  const provider = await this.resolveProvider(userId);
  const row = await this.prisma.packageService.findFirst({
    where: { packageId, providerId: provider.id, status: 'PENDING_PROVIDER_APPROVAL' },
    include: { package: { include: { provider: { include: { user: true } } } } },
  });
  if (!row) throw new NotFoundException('Join request not found or already resolved');

  await this.prisma.packageService.update({ where: { id: row.id }, data: { status: 'ACTIVE' } });

  this.domainEventBus.packageJoinAccepted({
    actorId: userId,
    targetUserId: row.package.provider.user.id,
    entityId: packageId,
    packageId,
    packageName: row.package.name,
    partnerProviderName: provider.businessName,
  });

  return {
    message:
      'Joined the package successfully. You will receive bookings automatically once the owner confirms, and the package discount will apply. You can leave later.',
    data: { packageId, status: 'ACTIVE' },
  };
}

async rejectJoinRequest(userId: string, packageId: string) {
  const provider = await this.resolveProvider(userId);
  const row = await this.prisma.packageService.findFirst({
    where: { packageId, providerId: provider.id, status: 'PENDING_PROVIDER_APPROVAL' },
    include: { package: { include: { provider: { include: { user: true } } } } },
  });
  if (!row) throw new NotFoundException('Join request not found or already resolved');

  await this.prisma.packageService.update({ where: { id: row.id }, data: { status: 'REJECTED' } });

  this.domainEventBus.packageJoinRejected({
    actorId: userId,
    targetUserId: row.package.provider.user.id,
    entityId: packageId,
    packageId,
    packageName: row.package.name,
    partnerProviderName: provider.businessName,
  });

  return { message: 'Join request rejected', data: { packageId, status: 'REJECTED' } };
}

async getJoinedPackages(userId: string) {
  const provider = await this.resolveProvider(userId);

  const rows = await this.prisma.packageService.findMany({
    where: { providerId: provider.id, status: 'ACTIVE' },
    select: { packageId: true },
    distinct: ['packageId'],
  });
  const packageIds = rows.map((r) => r.packageId);
  if (packageIds.length === 0) {
    return { message: 'Joined packages retrieved successfully', data: [] };
  }

  const packages = await this.prisma.package.findMany({
    where: { id: { in: packageIds } },
    select: {
      id: true,
      name: true,
      description: true,
      discountPercentage: true,
      status: true,
      provider: { select: { businessName: true, user: { select: { fullName: true, profileImage: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { message: 'Joined packages retrieved successfully', data: packages };
}

async getMyPackageBookings(userId: string, query: PackageBookingQueryDto) {
  const { page = 1, limit = 10, status } = query;
  const skip = (page - 1) * limit;
  const where: any = { customerId: userId, ...(status && { status }) };

  const [items, total] = await this.prisma.$transaction([
    this.prisma.packageEventBooking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        package: { select: { id: true, name: true, description: true, discountPercentage: true } },
        event: { select: { name: true, eventDate: true, eventLocation: true } },
        payment: true,
      },
    }),
    this.prisma.packageEventBooking.count({ where }),
  ]);

  return {
    message: 'Package bookings retrieved successfully',
    data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
  };
}


async getJoinedPackageDetails(userId: string, packageId: string) {
      
      const provider = await this.resolveProvider(userId);

        const pkg = await this.prisma.package.findUnique({
          where: { id: packageId },
          select: { id: true, providerId: true },
        });
      if (!pkg) throw new NotFoundException('Package not found');

      const isOwner = pkg.providerId === provider.id;
      if (!isOwner) {
        const membership = await this.prisma.packageService.findFirst({
          where: { packageId, providerId: provider.id, status: 'ACTIVE' },
        });
        if (!membership) throw new NotFoundException('You are not an active partner in this package');
      }

      const full = await this.prisma.package.findUnique({
        where: { id: packageId },
        include: {
          provider: { select: { businessName: true, user: { select: { fullName: true, profileImage: true, phoneNumber: true } } } },
          services: {
            // المالك يرى كل الخدمات (بما فيها PENDING_PROVIDER_APPROVAL)، الشريك يرى الفعّالة فقط
            where: isOwner ? undefined : { status: 'ACTIVE' },
            include: { service: { include: { serviceType: { select: { name: true } }, files: { take: 1 } } } },
          },
        },
      });

  return { message: 'Package details retrieved', data: full };
}

async leavePackage(userId: string, packageId: string) {
  const provider = await this.resolveProvider(userId);

  const pkg = await this.prisma.package.findUnique({
    where: { id: packageId },
    select: { id: true, name: true, status: true, providerId: true },
  });
  if (!pkg) throw new NotFoundException('Package not found');

  // ── الحالة أ: المستخدم هو مالك الباقة → إلغاء الباقة بالكامل ──
  if (pkg.providerId === provider.id) {
    return this.cancelOwnedPackage(userId, provider, pkg);
  }

  // ── الحالة ب: المستخدم شريك → مغادرة شراكته فقط ──
  const membership = await this.prisma.packageService.findFirst({
    where: { packageId, providerId: provider.id, status: 'ACTIVE' },
    include: { package: { include: { provider: { include: { user: true } } } } },
  });
  if (!membership) throw new NotFoundException('You are not an active partner in this package');

  const activeEngagement = await this.prisma.booking.findFirst({
    where: {
      serviceId: membership.serviceId,
      packageEventBookingId: { not: null },
      status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
    },
  });
  if (activeEngagement) {
    throw new BadRequestException(
      'Cannot leave while you have an active package booking engagement — complete it first',
    );
  }

  await this.prisma.packageService.update({ where: { id: membership.id }, data: { status: 'REJECTED' } });

  this.domainEventBus.packagePartnerLeft({
    actorId: userId,
    targetUserId: membership.package.provider.user.id,
    entityId: packageId,
    packageId,
    packageName: membership.package.name,
    partnerProviderName: provider.businessName,
  });

  const remainingActive = await this.prisma.packageService.count({
    where: { packageId, status: 'ACTIVE' },
  });
  if (remainingActive < 2 && membership.package.status === 'ACTIVE') {
    await this.prisma.package.update({ where: { id: packageId }, data: { status: 'DRAFT' } });
  }

  return {
    message:
      'You have left the package. You will no longer receive new bookings from it — please complete any currently active bookings.',
    data: { packageId, status: 'LEFT' },
  };
}

/**
 * مسار مالك الباقة عند استدعاء /leave: إلغاء الباقة بالكامل — رفض كل
 * الشراكات الفعالة/المعلّقة، وإشعار كل من كانت خدماتهم Active بأن الباقة أُلغيت.
 */
private async cancelOwnedPackage(
  userId: string,
  provider: { id: string; businessName: string },
  pkg: { id: string; name: string; status: string },
) {
  if (pkg.status === 'CANCELLED') {
    throw new BadRequestException('Package is already cancelled');
  }

  const activeBookings = await this.prisma.packageEventBooking.count({
    where: {
      packageId: pkg.id,
      status: { in: ['PENDING', 'CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] },
    },
  });
  if (activeBookings > 0) {
    throw new BadRequestException(
      'Cannot cancel a package that has active bookings — resolve them first',
    );
  }

  const activePartnerServices = await this.prisma.packageService.findMany({
    where: { packageId: pkg.id, status: 'ACTIVE' },
    include: { provider: { include: { user: true } } },
  });

  await this.prisma.$transaction(async (tx) => {
    await tx.packageService.updateMany({
      where: { packageId: pkg.id, status: { in: ['ACTIVE', 'PENDING_PROVIDER_APPROVAL'] } },
      data: { status: 'REJECTED' },
    });
    await tx.package.update({ where: { id: pkg.id }, data: { status: 'CANCELLED' } });
  });

  for (const ps of activePartnerServices) {
    if (ps.providerId === provider.id) continue; // لا نُشعر المالك بنفسه
    this.domainEventBus.packageCancelled({
      actorId: userId,
      targetUserId: ps.provider.user.id,
      entityId: pkg.id,
      packageId: pkg.id,
      packageName: pkg.name,
    });
  }

  return {
    message: 'Package cancelled. All partner memberships were rejected and partners have been notified.',
    data: { packageId: pkg.id, status: 'CANCELLED' },
  };
}

  // ════════════════════════════════════════════════════════════════════
  // PROVIDER — package-event-booking inbox
  // ════════════════════════════════════════════════════════════════════

  /**
   * `GET /api/v1/packages/bookings/pending`
   */
  // async getPendingPackageBookings(userId: string) {
  //   const provider = await this.resolveProvider(userId);
  //   const items = await this.prisma.packageEventBooking.findMany({
  //     where: { package: { providerId: provider.id }, status: 'PENDING' },
  //     include: {
  //       package: { select: { id: true, name: true } },
  //       customer: { select: { id: true, fullName: true, email: true } },
  //       event: { select: { name: true, eventDate: true, eventLocation: true } },
  //       bookings: { include: { service: { include: { serviceType: { select: { name: true } } } } } },
  //     },
  //     orderBy: { createdAt: 'desc' },
  //   });
  //   return { message: 'Pending package bookings retrieved', data: items };
  // }

  /**
   * `GET /api/v1/packages/bookings/payment-pending`
   */
  // async getPaymentPendingPackageBookings(userId: string) {
  //   const provider = await this.resolveProvider(userId);
  //   const items = await this.prisma.packageEventBooking.findMany({
  //     where: {
  //       package: { providerId: provider.id },
  //       status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
  //     },
  //     include: {
  //       package: { select: { id: true, name: true } },
  //       customer: { select: { id: true, fullName: true, email: true } },
  //       event: { select: { name: true, eventDate: true } },
  //       bookings: { include: { service: { include: { serviceType: { select: { name: true } } } } } },
  //     },
  //     orderBy: { updatedAt: 'desc' },
  //   });
  //   return { message: 'Payment-pending package bookings retrieved', data: items };
  // }

  /**
   * `GET /api/v1/packages/bookings/:id` — owner view
   */
  async getPackageBookingForProvider(userId: string, packageEventBookingId: string) {
    const provider = await this.resolveProvider(userId);
    return this.getPackageEventBookingOrThrow(packageEventBookingId, {
      providerId: provider.id,
    });
  }

  async acceptPackageBooking(userId: string, packageEventBookingId: string) {
  const provider = await this.resolveProvider(userId);
  const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, { providerId: provider.id });

  if (pb.status !== 'PENDING') {
    throw new BadRequestException(`Package booking cannot be accepted while it is ${pb.status}`);
  }

  const paymentExpiresAt = new Date(Date.now() + PACKAGE_PAYMENT_TIMEOUT_HOURS * 60 * 60 * 1000);

  await this.prisma.$transaction(async (tx) => {
    await tx.packageEventBooking.update({
      where: { id: packageEventBookingId },
      data: { status: 'PENDING_PAYMENT', paymentExpiresAt },
    });
    await tx.booking.updateMany({
      where: { packageEventBookingId, status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
    await tx.payment.create({
      data: {
        packageEventBookingId,
        payerId: pb.customerId,
        amount: pb.totalAmount,
        subtotalAmount: pb.totalAmount,
        method: 'CASH', // placeholder — العميل سيحدد الطريقة الفعلية عند الدفع
        status: 'PENDING',
      },
    });
  });

  this.domainEventBus.packageBookingAccepted({
    actorId: userId,
    targetUserId: pb.customerId,
    entityId: packageEventBookingId,
    packageId: pb.packageId,
    packageName: pb.package.name,
    packageEventBookingId,
  });

  return {
    message: 'Package booking accepted. Customer has 24 hours to confirm payment.',
    data: { id: packageEventBookingId, status: 'PENDING_PAYMENT' },
  };
}

  /**
   * `POST /api/v1/packages/bookings/:id/reject`
   */
  async rejectPackageBooking(
    userId: string,
    packageEventBookingId: string,
    reason?: string,
  ) {
    const provider = await this.resolveProvider(userId);
    const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, {
      providerId: provider.id,
    });

    if (!['PENDING', 'CONFIRMED', 'PENDING_PAYMENT'].includes(pb.status)) {
      throw new BadRequestException(
        `Package booking cannot be rejected while it is ${pb.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.packageEventBooking.update({
        where: { id: packageEventBookingId },
        data: { status: 'REJECTED' },
      });
      // Cancel any child bookings that haven't already terminated
      await tx.booking.updateMany({
        where: {
          packageEventBookingId,
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: 'PROVIDER',
          cancellationReason: reason ?? 'Package booking rejected by provider',
        },
      });
    });

    this.domainEventBus.packageBookingRejected({
      actorId: userId,
      targetUserId: pb.customerId,
      entityId: packageEventBookingId,
      packageId: pb.packageId,
      packageName: pb.package.name,
      packageEventBookingId,
      rejectionReason: reason,
    });

    return { message: 'Package booking rejected', data: { id: packageEventBookingId, status: 'REJECTED' } };
  }

 async confirmPackageCashPayment(userId: string, packageEventBookingId: string) {
  const provider = await this.resolveProvider(userId);
  const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, { providerId: provider.id });

  if (pb.status !== 'PENDING_PAYMENT') {
    throw new BadRequestException(`Package booking cannot have its payment confirmed while it is ${pb.status}`);
  }
  if (!pb.payment || pb.payment.method !== 'CASH' || pb.payment.status !== 'PROCESSING') {
    throw new BadRequestException('No pending cash payment found for this package booking');
  }

  await this.prisma.payment.update({
    where: { id: pb.payment.id },
    data: { status: 'PAID', paidAt: new Date() },
  });
  await this.progressPackageToInProgress(packageEventBookingId);

  const partners = await this.getPackagePartnerUserIds(pb.packageId);
  for (const partnerUserId of partners) {
    this.domainEventBus.packagePaymentConfirmed({
      actorId: userId,
      targetUserId: partnerUserId,
      entityId: packageEventBookingId,
      packageId: pb.packageId,
      packageName: pb.package.name,
      packageEventBookingId,
      amount: pb.totalAmount,
    });
  }

  return { message: 'Cash payment confirmed — booking is now in progress', data: { id: packageEventBookingId } };
}

  /**
   * `POST /api/v1/packages/bookings/:id/complete`
   * Manual completion (per implementation_plan.md §7 Minimal-Safe Cut #3).
   * Only valid once every child booking is IN_PROGRESS.
   */
  async completePackageBooking(userId: string, packageEventBookingId: string) {
    const provider = await this.resolveProvider(userId);
    const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, {
      providerId: provider.id,
    });

    if (pb.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Package booking cannot be completed while it is ${pb.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.packageEventBooking.update({
        where: { id: packageEventBookingId },
        data: { status: 'COMPLETED' },
      });
      await tx.booking.updateMany({
        where: { packageEventBookingId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      // The parent event also completes
      if (pb.eventId) {
        await tx.event.update({
          where: { id: pb.eventId },
          data: { status: 'COMPLETED' },
        });
      }
    });

    return { message: 'Package booking completed', data: { id: packageEventBookingId, status: 'COMPLETED' } };
  }

  // ════════════════════════════════════════════════════════════════════
  // CUSTOMER — exclusive-package browsing + booking + payment
  // ════════════════════════════════════════════════════════════════════

  /**
   * `GET /api/v1/packages/exclusive`
   * Lists all ACTIVE packages from all providers. Public catalog.
   */
  async listExclusivePackages() {
    const packages = await this.prisma.package.findMany({
      where: { status: 'ACTIVE' },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            user: {
              select: {
                fullName: true,
                profileImage: true,
                locationName: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
        services: {
          include: { service: { include: { serviceType: { select: { name: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { message: 'Exclusive packages retrieved', data: packages };
  }

  /**
   * `GET /api/v1/packages/exclusive/:id`
   * Public detail of an ACTIVE package.
   */
  async getExclusivePackageDetails(packageId: string) {
    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, status: 'ACTIVE' },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            user: {
              select: {
                fullName: true,
                profileImage: true,
                locationName: true,
                latitude: true,
                longitude: true,
                phoneNumber: true,
              },
            },
          },
        },
        services: {
          include: {
            service: {
              include: {
                serviceType: { select: { name: true } },
                files: { take: 1 },
              },
            },
          },
        },
      },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return { message: 'Exclusive package details retrieved', data: pkg };
  }

  /**
   * `POST /api/v1/packages/exclusive/:id/book`
   * Customer books an entire exclusive package:
   *   1. Creates a new Event (DRAFT).
   *   2. Creates a PackageEventBooking (PENDING).
   *   3. Creates one PENDING child Booking per ACTIVE PackageService row,
   *      each pre-priced at the service's `price` (HALL/SOUND) or sub-service
   *      sum (others). Prices stored on `Booking.totalAmount` — payments are
   *      resolved later through PaymentsService.
   *
   * The package's own `discountPercentage` and any PACKAGE-scope discount
   * code are applied to `PackageEventBooking.totalAmount` (cached sum).
   */
  async bookPackage(customerId: string, packageId: string, dto: BookPackageDto) {
    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, status: 'ACTIVE' },
      include: {
        services: {
          where: { status: 'ACTIVE' },
          include: {
            service: {
              include: {
                serviceType: { select: { name: true } },
                subServices: { where: { isAvailable: true, approvalStatus: 'ACTIVE' } },
              },
            },
          },
        },
        provider: { include: { user: true } },
      },
    });
    if (!pkg) throw new NotFoundException('Package not found or not active');

    if (dto.eventStartTime === dto.eventEndTime) {
      throw new BadRequestException('eventEndTime must be different from eventStartTime');
    }

const existingActive = await this.prisma.packageEventBooking.findFirst({
  where: {
    packageId: pkg.id,
    customerId,
    status: { in: ['PENDING', 'CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] },
  },
});
if (existingActive) {
  throw new ConflictException(
    'You already have an active booking request for this package. Cancel it before creating a new one.',
  );
}
    // Resolve PACKAGE-scope discount (auto-applied unless a code is required).
    const pkgDiscount = await this.discountsService.resolveActiveDiscountForPackage(
      pkg.id,
      dto.discountCode,
    );

    // Build every child Booking inside one transaction so that price
    // computation is consistent and the package is rejected atomically if
    // anything throws.
    const result = await this.prisma.$transaction(
      async (tx) => {
        const event = await tx.event.create({
          data: {
            customerId,
            name: dto.name,
            eventType: dto.eventType,
            eventDate: new Date(dto.eventDate),
            eventStartTime: dto.eventStartTime,
            eventEndTime: dto.eventEndTime,
            eventLocation: dto.eventLocation,
            numberOfGuests: dto.numberOfGuests,
            customerNotes: dto.customerNotes,
            status: 'DRAFT',
          },
        });

        let totalAmount = 0;
        const childBookings: Prisma.BookingCreateWithoutPackageEventBookingInput[] = [];

        for (const ps of pkg.services) {
          const svc = ps.service;
          const isHallOrSound = ['HALL', 'SOUND'].includes(svc.serviceType.name);
          const basePrice = isHallOrSound ? (svc.price ?? 0) : sumMinSubServicePrice(svc);
          totalAmount += basePrice;

          childBookings.push({
            customer: { connect: { id: customerId } },
            provider: { connect: { id: pkg.providerId } },
            service: { connect: { id: svc.id } },
            event: { connect: { id: event.id } },
            totalAmount: basePrice,
            status: 'PENDING',
            cancellationDeadline: new Date(
              Date.now() + PACKAGE_BOOKING_REQUEST_TIMEOUT_HOURS * 60 * 60 * 1000,
            ),
          });
        }

        const packageEventBooking = await tx.packageEventBooking.create({
          data: {
            packageId: pkg.id,
            customerId,
            eventId: event.id,
            status: 'PENDING',
            totalAmount: round2(totalAmount),
            pendingExpiresAt: new Date(Date.now() + PACKAGE_BOOKING_REQUEST_TIMEOUT_HOURS * 60 * 60 * 1000), // ← جديد
            bookings: { create: childBookings },
          },
          include: {
            bookings: true,
            event: true,
          },
        });

        return { event, packageEventBooking };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Apply package-level discount (either the package's own
    // `discountPercentage` field or a PACKAGE-scope discount code) to the
    // cached totalAmount on PackageEventBooking. Per-child booking prices
    // remain authoritative — payments compute their own discount per booking.
    await this.applyPackageTotalDiscount(result.packageEventBooking.id, pkgDiscount, pkg.discountPercentage);

    this.domainEventBus.packageBookingRequested({
      actorId: customerId,
      targetUserId: pkg.provider.user.id,
      entityId: result.packageEventBooking.id,
      packageId: pkg.id,
      packageName: pkg.name,
      packageEventBookingId: result.packageEventBooking.id,
      eventDate: result.event.eventDate,
    });

    return {
      message: 'Package booking created (PENDING)',
      data: {
        packageEventBooking: result.packageEventBooking,
        event: result.event,
      },
    };
  }

  /**
   * `GET /api/v1/packages/bookings/:id` — customer view of their own
   * PackageEventBooking.
   */
  async getPackageBookingForCustomer(userId: string, packageEventBookingId: string) {
    return this.getPackageEventBookingOrThrow(packageEventBookingId, {
      customerId: userId,
    });
  }

  async cancelPackageBooking(userId: string, packageEventBookingId: string, reason?: string) {
  const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, { customerId: userId });

  const cancellable =
    pb.status === 'PENDING' ||
    (pb.status === 'PENDING_PAYMENT' && pb.payment?.status !== 'PAID');

  if (!cancellable) {
    throw new BadRequestException(`Package booking cannot be cancelled while it is ${pb.status}`);
  }

  await this.prisma.$transaction(async (tx) => {
    await tx.packageEventBooking.update({ where: { id: packageEventBookingId }, data: { status: 'CANCELLED' } });
    await tx.booking.updateMany({
      where: { packageEventBookingId, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'CUSTOMER', cancellationReason: reason ?? 'Cancelled by customer' },
    });
    if (pb.payment && pb.payment.status !== 'PAID') {
      await tx.payment.update({ where: { id: pb.payment.id }, data: { status: 'CANCELLED' } });
    }
  });

  return { message: 'Package booking cancelled', data: { id: packageEventBookingId, status: 'CANCELLED' } };
}

 async payPackageBooking(userId: string, packageEventBookingId: string, dto: PayPackageBookingDto) {
  const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, { customerId: userId });

  if (pb.status !== 'PENDING_PAYMENT') {
    throw new BadRequestException(`Package booking cannot be paid while it is ${pb.status}`);
  }
  if (!pb.payment) throw new NotFoundException('No payment record found for this package booking');
  if (pb.payment.status === 'PAID') {
    return { message: 'Payment already completed', data: pb.payment };
  }

  if (dto.method === PaymentMethod.BANK_TRANSFER) {
    const paid = await this.prisma.payment.update({
      where: { id: pb.payment.id },
      data: { method: dto.method, status: PaymentStatus.PAID, paidAt: new Date(), providerReference: `MOCK-BT-${pb.id}-${Date.now()}` },
    });
    await this.progressPackageToInProgress(packageEventBookingId);

    const partners = await this.getPackagePartnerUserIds(pb.packageId);
    for (const partnerUserId of partners) {
      this.domainEventBus.packagePaymentConfirmed({
        actorId: userId,
        targetUserId: partnerUserId,
        entityId: packageEventBookingId,
        packageId: pb.packageId,
        packageName: pb.package.name,
        packageEventBookingId,
        amount: pb.totalAmount,
      });
    }
    return { message: 'Bank transfer confirmed — booking is now in progress', data: paid };
  }

  // CASH — يبقى PROCESSING بانتظار تأكيد صاحب الباقة
  const processing = await this.prisma.payment.update({
    where: { id: pb.payment.id },
    data: { method: dto.method, status: PaymentStatus.PROCESSING },
  });

  this.domainEventBus.packagePaymentCashChosen({
    actorId: userId,
    targetUserId: pb.package.provider.user.id,
    entityId: packageEventBookingId,
    packageId: pb.packageId,
    packageName: pb.package.name,
    packageEventBookingId,
    amount: pb.totalAmount,
  });

  return {
    message: 'Booking confirmed — payment will be confirmed once you hand cash to the package owner',
    data: processing,
  };
}

private async getPackagePartnerUserIds(packageId: string): Promise<string[]> {
  const rows = await this.prisma.packageService.findMany({
    where: { packageId, status: 'ACTIVE' },
    include: { provider: { select: { userId: true } } },
  });
  return [...new Set(rows.map((r) => r.provider.userId))];
}

private async progressPackageToInProgress(packageEventBookingId: string) {
  const pb = await this.prisma.packageEventBooking.findUnique({
    where: { id: packageEventBookingId },
    select: { eventId: true },
  });
  await this.prisma.$transaction(async (tx) => {
    await tx.packageEventBooking.update({
      where: { id: packageEventBookingId },
      data: { status: 'IN_PROGRESS' },
    });
    await tx.booking.updateMany({
      where: { packageEventBookingId, status: 'CONFIRMED' },
      data: { status: 'IN_PROGRESS', acceptedAt: new Date() },
    });
    if (pb?.eventId) {
      await tx.event.update({ where: { id: pb.eventId }, data: { status: 'IN_PROGRESS' } });
    }
  });
}

  // ════════════════════════════════════════════════════════════════════
  // Progression — called by PaymentsService.markPaid and the cron jobs.
  // ════════════════════════════════════════════════════════════════════

  /**
   * Re-evaluates a PackageEventBooking's progression. If every child
   * Booking is either paid (has a PAID Payment) or already terminal,
   * promote the package booking and its parent Event to IN_PROGRESS.
   * (docs/implementation_plan.md §6.3 / §5.)
   */
  async tryProgressPackageBooking(packageEventBookingId: string): Promise<void> {
    const pb = await this.prisma.packageEventBooking.findUnique({
      where: { id: packageEventBookingId },
      include: {
        bookings: { include: { payment: true } },
        event: true,
        package: { include: { provider: { include: { user: true } } } },
      },
    });
    if (!pb) return;
    if (pb.status !== 'CONFIRMED' && pb.status !== 'PENDING_PAYMENT') return;

    const TERMINAL = ['COMPLETED', 'CANCELLED', 'REJECTED'];
    const allSettled = pb.bookings.every((b) => {
      if (TERMINAL.includes(b.status)) return true;
      if (b.status === 'CONFIRMED') return b.payment?.status === 'PAID';
      if (b.status === 'IN_PROGRESS') return true;
      return false;
    });
    if (!allSettled) return;

    const toAdvance = pb.bookings.filter(
      (b) => b.status === 'CONFIRMED' && b.payment?.status === 'PAID',
    );
    if (toAdvance.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { id: { in: toAdvance.map((b) => b.id) } },
        data: { status: 'IN_PROGRESS', acceptedAt: new Date() },
      });
      await tx.packageEventBooking.update({
        where: { id: packageEventBookingId },
        data: { status: 'IN_PROGRESS' },
      });
      if (pb.eventId && pb.event && pb.event.status === 'DRAFT') {
        await tx.event.update({
          where: { id: pb.eventId },
          data: { status: 'IN_PROGRESS' },
        });
      }
    });

    this.domainEventBus.packagePaymentConfirmed({
      actorId: pb.customerId,
      targetUserId: pb.package.provider.user.id,
      entityId: packageEventBookingId,
      packageId: pb.packageId,
      packageName: pb.package.name,
      packageEventBookingId,
      amount: pb.totalAmount,
    });
  }

  async getPackageBookings(userId: string, status?: PackageEventBookingStatus) {
  const provider = await this.resolveProvider(userId);
  const where: any = {
    package: { providerId: provider.id },
    status: status ?? { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS' , 'COMPLETED'] },
  };

  const items = await this.prisma.packageEventBooking.findMany({
    where,
    include: {
      package: { select: { id: true, name: true, discountPercentage: true } },
      customer: { select: { id: true, fullName: true, email: true } },
      event: { select: { name: true, eventDate: true, eventLocation: true } },
      bookings: { include: { service: { include: { serviceType: { select: { name: true } } } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return { message: 'Package bookings retrieved', data: items };
}

/** @deprecated استخدم getPackageBookings(userId, 'PENDING') */
async getPendingPackageBookings(userId: string) {
  return this.getPackageBookings(userId, 'PENDING' as PackageEventBookingStatus);
}

/** @deprecated استخدم getPackageBookings(userId) بدون status (يشمل PENDING_PAYMENT + CONFIRMED) */
async getPaymentPendingPackageBookings(userId: string) {
  const provider = await this.resolveProvider(userId);
  const items = await this.prisma.packageEventBooking.findMany({
    where: { package: { providerId: provider.id }, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } },
    include: {
      package: { select: { id: true, name: true } },
      customer: { select: { id: true, fullName: true, email: true } },
      event: { select: { name: true, eventDate: true } },
      bookings: { include: { service: { include: { serviceType: { select: { name: true } } } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return { message: 'Payment-pending package bookings retrieved', data: items };
}

  // ─── private helpers ────────────────────────────────────────────────

  private async applyPackageTotalDiscount(
    packageEventBookingId: string,
    discount: Discount | null,
    discountPercentage?: number | null,
  ) {
    const pb = await this.prisma.packageEventBooking.findUnique({
      where: { id: packageEventBookingId },
    });
    if (!pb) return;

    const base = pb.totalAmount;
    let finalTotal = base;

    // Package-authored discount percentage always applies (legacy field).
    if (discountPercentage && discountPercentage > 0) {
      finalTotal = applyPctOff(finalTotal, discountPercentage);
    }
    // PACKAGE-scope discount (admin or provider) stacks ON TOP of the
    // package-authored discount when both exist (rare in practice).
    if (discount) {
      const pricing = this.discountsService.computePriceWithDiscount(finalTotal, discount);
      finalTotal = pricing.finalPrice;
    }

    if (Math.abs(finalTotal - base) > 0.0001) {
      await this.prisma.packageEventBooking.update({
        where: { id: packageEventBookingId },
        data: { totalAmount: round2(finalTotal) },
      });
    }
  }
}

// ─── module-level helpers ────────────────────────────────────────────

function sumMinSubServicePrice(service: { price: number | null; subServices: { pricePerUnit: number }[] }) {
  if (service.subServices.length === 0) return service.price ?? 0;
  // For package preview we use a placeholder of "1 unit of the cheapest
  // sub-service". Real per-booking pricing is resolved when the provider
  // sends a quote via the standard quote flow; package bookings skip that
  // step, so we use this conservative default.
  const cheapest = service.subServices.reduce(
    (min, ss) => (ss.pricePerUnit < min ? ss.pricePerUnit : min),
    service.subServices[0].pricePerUnit,
  );
  return cheapest;
}

function applyPctOff(price: number, pct: number) {
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
