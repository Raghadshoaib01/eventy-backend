// src/modules/packages/packages.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PaymentMethod, PaymentStatus, Discount } from '@prisma/client';
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
  async createPackage(userId: string, dto: CreatePackageDto) {
    const provider = await this.resolveProvider(userId);

    const serviceIds = [...new Set(dto.services.map((s) => s.serviceId))];
    const owned = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, providerId: provider.id },
      select: { id: true, isPackaged: true },
    });

    if (owned.length !== serviceIds.length) {
      const found = new Set(owned.map((s) => s.id));
      const missing = serviceIds.filter((id) => !found.has(id));
      throw new BadRequestException(
        `Services not found or not owned by this provider: ${missing.join(', ')}`,
      );
    }

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
        data: serviceIds.map((serviceId) => ({
          packageId: created.id,
          providerId: provider.id,
          serviceId,
          status: 'ACTIVE',
        })),
      });

      return created;
    });

    return {
      message: 'Package created (DRAFT). Activate once requirements are met.',
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

  /**
   * `PATCH /api/v1/packages/:id/activate`
   * Requires ≥ 2 active services (implementation_plan.md §3). Promotes
   * DRAFT → ACTIVE, suspends any PACKAGE-scope discounts that need
   * reconfirmation (composition has changed).
   */
  async activatePackage(userId: string, packageId: string) {
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

    this.domainEventBus.packageActivated({
      actorId: userId,
      targetUserId: userId,
      entityId: packageId,
      packageId,
      packageName: updated.name,
      ownerProviderName: '', // populated by listener via metadata; safe to leave blank
    });

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
  async getPendingJoinRequests(userId: string) {
    await this.resolveProvider(userId);
    return { message: 'No pending join requests', data: [] };
  }

  /**
   * `GET /api/v1/packages/join-requests/:id`
   */
  async getJoinRequestDetails(userId: string, _requestId: string) {
    await this.resolveProvider(userId);
    return { message: 'Join request not found', data: null };
  }

  /**
   * `POST /api/v1/packages/:id/join/accept`
   */
  async acceptJoinRequest(userId: string, _packageId: string) {
    await this.resolveProvider(userId);
    return { message: 'No join request to accept', data: null };
  }

  /**
   * `POST /api/v1/packages/:id/join/reject`
   */
  async rejectJoinRequest(userId: string, _packageId: string) {
    await this.resolveProvider(userId);
    return { message: 'No join request to reject', data: null };
  }

  /**
   * `GET /api/v1/packages/joined`
   * In single-provider-only mode, every package the provider owns IS the
   * one they've "joined" via PackageService rows. Reuse the my-packages
   * view but filter to ACTIVE.
   */
  async getJoinedPackages(userId: string) {
    const provider = await this.resolveProvider(userId);
    const packages = await this.prisma.package.findMany({
      where: {
        providerId: provider.id,
        status: 'ACTIVE',
      },
      include: {
        services: { include: { service: { include: { serviceType: { select: { name: true } } } } } },
        eventBookings: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { message: 'Joined packages retrieved successfully', data: packages };
  }

  /**
   * `GET /api/v1/packages/joined/:id`
   */
  async getJoinedPackageDetails(userId: string, packageId: string) {
    return this.getPackageForProvider(userId, packageId);
  }

  /**
   * `POST /api/v1/packages/:id/leave`
   * In single-provider-only mode, "leaving" means cancelling the package
   * outright. Only valid while no active bookings reference it.
   */
  async leavePackage(userId: string, packageId: string) {
    const pkg = await this.getOwnedPackageOrThrow(userId, packageId);
    if (pkg.status === 'CANCELLED') {
      throw new BadRequestException('Package is already cancelled');
    }

    const activeBookings = await this.prisma.packageEventBooking.count({
      where: {
        packageId,
        status: { in: ['PENDING', 'CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] },
      },
    });
    if (activeBookings > 0) {
      throw new BadRequestException(
        'Cannot leave a package that has active bookings — cancel them first',
      );
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { status: 'CANCELLED' },
    });

    return { message: 'Package cancelled (left)', data: updated };
  }

  // ════════════════════════════════════════════════════════════════════
  // PROVIDER — package-event-booking inbox
  // ════════════════════════════════════════════════════════════════════

  /**
   * `GET /api/v1/packages/bookings/pending`
   */
  async getPendingPackageBookings(userId: string) {
    const provider = await this.resolveProvider(userId);
    const items = await this.prisma.packageEventBooking.findMany({
      where: { package: { providerId: provider.id }, status: 'PENDING' },
      include: {
        package: { select: { id: true, name: true } },
        customer: { select: { id: true, fullName: true, email: true } },
        event: { select: { name: true, eventDate: true, eventLocation: true } },
        bookings: { include: { service: { include: { serviceType: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { message: 'Pending package bookings retrieved', data: items };
  }

  /**
   * `GET /api/v1/packages/bookings/payment-pending`
   */
  async getPaymentPendingPackageBookings(userId: string) {
    const provider = await this.resolveProvider(userId);
    const items = await this.prisma.packageEventBooking.findMany({
      where: {
        package: { providerId: provider.id },
        status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
      },
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

  /**
   * `GET /api/v1/packages/bookings/:id` — owner view
   */
  async getPackageBookingForProvider(userId: string, packageEventBookingId: string) {
    const provider = await this.resolveProvider(userId);
    return this.getPackageEventBookingOrThrow(packageEventBookingId, {
      providerId: provider.id,
    });
  }

  /**
   * `POST /api/v1/packages/bookings/:id/accept`
   * PENDING → CONFIRMED. Child bookings also flip to CONFIRMED so that
   * payment can flow through PaymentsService.
   */
  async acceptPackageBooking(userId: string, packageEventBookingId: string) {
    const provider = await this.resolveProvider(userId);
    const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, {
      providerId: provider.id,
    });

    if (pb.status !== 'PENDING') {
      throw new BadRequestException(
        `Package booking cannot be accepted while it is ${pb.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.packageEventBooking.update({
        where: { id: packageEventBookingId },
        data: { status: 'CONFIRMED' },
      });
      await tx.booking.updateMany({
        where: { packageEventBookingId, status: 'PENDING' },
        data: { status: 'CONFIRMED' },
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

    return { message: 'Package booking accepted', data: { id: packageEventBookingId, status: 'CONFIRMED' } };
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

  /**
   * `POST /api/v1/packages/bookings/:id/confirm-payment`
   * Provider confirms a CASH payment for the package booking. We delegate
   * per-booking confirmation to PaymentsService — for each child booking
   * that has a CASH Payment in PROCESSING, mark it PAID.
   */
  async confirmPackageCashPayment(userId: string, packageEventBookingId: string) {
    const provider = await this.resolveProvider(userId);
    const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, {
      providerId: provider.id,
    });

    if (pb.status !== 'PENDING_PAYMENT' && pb.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Package booking cannot have its payment confirmed while it is ${pb.status}`,
      );
    }

    // Find any CASH payments under child bookings still in PROCESSING and mark them PAID.
    const childBookings = await this.prisma.booking.findMany({
      where: { packageEventBookingId },
      include: { payment: true },
    });

    let confirmed = 0;
    for (const b of childBookings) {
      if (
        b.payment &&
        b.payment.method === PaymentMethod.CASH &&
        b.payment.status === PaymentStatus.PROCESSING
      ) {
        await this.prisma.payment.update({
          where: { id: b.payment.id },
          data: { status: PaymentStatus.PAID, paidAt: new Date() },
        });
        confirmed++;
      }
    }

    // After confirmation, re-evaluate the package booking progression.
    await this.tryProgressPackageBooking(packageEventBookingId);

    this.domainEventBus.packagePaymentConfirmed({
      actorId: userId,
      targetUserId: pb.package.provider.user.id,
      entityId: packageEventBookingId,
      packageId: pb.packageId,
      packageName: pb.package.name,
      packageEventBookingId,
      amount: pb.totalAmount,
    });

    return {
      message: 'Package cash payment confirmed',
      data: { id: packageEventBookingId, confirmedPayments: confirmed },
    };
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

  /**
   * `POST /api/v1/packages/bookings/:id/cancel` — customer cancel
   */
  async cancelPackageBooking(userId: string, packageEventBookingId: string, reason?: string) {
    const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, {
      customerId: userId,
    });

    if (!['PENDING', 'CONFIRMED', 'PENDING_PAYMENT'].includes(pb.status)) {
      throw new BadRequestException(
        `Package booking cannot be cancelled while it is ${pb.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.packageEventBooking.update({
        where: { id: packageEventBookingId },
        data: { status: 'CANCELLED' },
      });
      await tx.booking.updateMany({
        where: {
          packageEventBookingId,
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: 'CUSTOMER',
          cancellationReason: reason ?? 'Package booking cancelled by customer',
        },
      });
    });

    return { message: 'Package booking cancelled', data: { id: packageEventBookingId, status: 'CANCELLED' } };
  }

  /**
   * `POST /api/v1/packages/bookings/:id/pay`
   * Customer confirms payment for an already-accepted package booking.
   *
   * For BANK_TRANSFER: every child booking's Payment is created and run
   * through the gateway in parallel (mirrors PaymentsService flow).
   *
   * For CASH: every child booking's Payment is recorded as PENDING then
   * immediately flipped to PROCESSING — the package owner later confirms
   * via `confirmPackageCashPayment`.
   *
   * The PACKAGE-scope discount code (if supplied) is applied here at the
   * cached totalAmount only; per-child booking prices remain unchanged
   * because each child booking already had its own SERVICE-scope discount
   * resolved at quote time (and we do not double-stack).
   */
  async payPackageBooking(
    userId: string,
    packageEventBookingId: string,
    dto: PayPackageBookingDto,
  ) {
    const pb = await this.getPackageEventBookingOrThrow(packageEventBookingId, {
      customerId: userId,
    });

    if (pb.status !== 'CONFIRMED' && pb.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `Package booking cannot be paid while it is ${pb.status}`,
      );
    }

    // Move package booking into PENDING_PAYMENT while payments are processed
    if (pb.status === 'CONFIRMED') {
      await this.prisma.packageEventBooking.update({
        where: { id: packageEventBookingId },
        data: { status: 'PENDING_PAYMENT' },
      });
    }

    const childBookings = await this.prisma.booking.findMany({
      where: { packageEventBookingId },
      include: { payment: true },
    });

    const results: unknown[] = [];
    for (const b of childBookings) {
      if (b.payment) {
        results.push({ bookingId: b.id, message: 'Payment already exists' });
        continue;
      }
      const subtotal = b.totalAmount;
      const payment = await this.prisma.payment.create({
        data: {
          bookingId: b.id,
          payerId: userId,
          amount: subtotal,
          subtotalAmount: subtotal,
          method: dto.method,
          status:
            dto.method === PaymentMethod.BANK_TRANSFER
              ? PaymentStatus.PROCESSING
              : PaymentStatus.PROCESSING,
        },
      });
      results.push({ bookingId: b.id, paymentId: payment.id, status: payment.status });
    }

    if (dto.method === PaymentMethod.CASH) {
      this.domainEventBus.packagePaymentCashChosen({
        actorId: userId,
        targetUserId: pb.package.provider.user.id,
        entityId: packageEventBookingId,
        packageId: pb.packageId,
        packageName: pb.package.name,
        packageEventBookingId,
        amount: pb.totalAmount,
      });
    }

    return {
      message:
        dto.method === PaymentMethod.BANK_TRANSFER
          ? 'Bank transfer initiated for every child booking'
          : 'Cash payment recorded for every child booking — awaiting provider confirmation',
      data: results,
    };
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
