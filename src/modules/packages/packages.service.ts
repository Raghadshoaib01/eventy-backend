import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ServicesService } from '../services/services.service';
import { CreateServiceDto } from '../services/dto/create-service.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { AttachServiceDto } from './dto/attach-service.dto';
import { PriceQuoteQueryDto } from './dto/price-quote-query.dto';
import { CreatePackageBookingDto } from './dto/create-package-booking.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { PackagePricingStrategy, PackageStatus, PackageChangeStatus } from '@prisma/client';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { DiscountsService } from '../discounts/discounts.service';
import { DeliveryService } from '../delivery/delivery.service';

/**
 * PackagesService
 *
 * Provider-facing package CRUD + both add-service paths
 * (docs/packages-implementation-plan.md §5.1–§5.3, §7, §8.1).
 */
@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesService: ServicesService,
    private readonly domainEventBus: DomainEventBus,
    private readonly discountsService: DiscountsService,
    private readonly deliveryService: DeliveryService,
  ) {}

  // ── shared helpers ──────────────────────────────────────────

  private async getOwnerProvider(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });
    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }
    return user.provider;
  }

  private async getOwnedPackage(userId: string, packageId: string) {
    const provider = await this.getOwnerProvider(userId);
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.providerId !== provider.id) {
      throw new ForbiddenException('Access denied');
    }
    return { provider, package: pkg };
  }

  /**
   * Composes exclusive + attached services into one list with a
   * response-only `membershipType` discriminator (docs §4).
   */
  private async composeDetail(packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        exclusiveServices: { include: { serviceType: true } },
        attachedItems: { include: { service: { include: { serviceType: true } } } },
      },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    const { exclusiveServices, attachedItems, ...rest } = pkg;
    const services = [
      ...exclusiveServices.map((s) => ({ ...s, membershipType: 'EXCLUSIVE' as const, isRequired: true })),
      ...attachedItems.map((i) => ({
        ...i.service,
        membershipType: 'ATTACHED' as const,
        isRequired: i.isRequired,
        packageItemId: i.id,
      })),
    ];

    return { ...rest, services };
  }

  /** True if `serviceId` is this package's Hall (docs §7, §8.1). */
  private isHallService(services: Array<{ id: string; serviceType: { isVenue: boolean } }>, serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    return !!svc?.serviceType.isVenue;
  }

  // ── CRUD ─────────────────────────────────────────────────────

  async createPackage(userId: string, dto: CreatePackageDto) {
    const provider = await this.getOwnerProvider(userId);

    const pkg = await this.prisma.package.create({
      data: {
        providerId: provider.id,
        name: dto.name,
        description: dto.description,
        pricingStrategy: dto.pricingStrategy ?? PackagePricingStrategy.FLAT_SUM,
        status: PackageStatus.DRAFT,
      },
    });

    return { message: 'Package created successfully', data: pkg };
  }

  async updatePackage(userId: string, packageId: string, dto: UpdatePackageDto) {
    await this.getOwnedPackage(userId, packageId);

    const pkg = await this.prisma.package.update({
      where: { id: packageId },
      data: { name: dto.name, description: dto.description },
    });

    return { message: 'Package updated successfully', data: pkg };
  }

  async listMyPackages(userId: string) {
    const provider = await this.getOwnerProvider(userId);

    const packages = await this.prisma.package.findMany({
      where: { providerId: provider.id },
      include: {
        _count: { select: { exclusiveServices: true, attachedItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { message: 'Packages retrieved successfully', data: packages };
  }

  async getPackageById(userId: string, packageId: string) {
    await this.getOwnedPackage(userId, packageId);
    const detail = await this.composeDetail(packageId);
    return { message: 'Package retrieved successfully', data: detail };
  }

  async deletePackage(userId: string, packageId: string) {
    const { package: pkg } = await this.getOwnedPackage(userId, packageId);

    if (pkg.status !== PackageStatus.DRAFT && pkg.status !== PackageStatus.REJECTED) {
      throw new BadRequestException(
        `Package cannot be deleted while it is ${pkg.status} — only DRAFT or REJECTED packages can be deleted`,
      );
    }

    // Cascade is handled at the DB level: Service.packageId and
    // PackageItem.packageId both have onDelete: Cascade
    // (docs/packages-implementation-plan.md §2.2, §2.3).
    await this.prisma.package.delete({ where: { id: packageId } });

    return { message: 'Package deleted successfully', data: null };
  }

  // ── adding services (docs §5.1) ─────────────────────────────

  /** Path 1 — create a package-exclusive service (docs §5.3). */
  async createExclusiveService(
    userId: string,
    packageId: string,
    dto: CreateServiceDto,
    serviceLogo?: Express.Multer.File,
    businessFile?: Express.Multer.File,
    subServiceMedia?: Express.Multer.File[],
  ) {
    await this.getOwnedPackage(userId, packageId);

    return this.servicesService.createService(
      userId,
      dto,
      serviceLogo,
      businessFile,
      subServiceMedia,
      packageId,
    );
  }

  /** Path 2 — attach an existing service the caller already owns (docs §2.3, §2.5). */
  async attachExistingService(userId: string, packageId: string, dto: AttachServiceDto) {
    const { provider } = await this.getOwnedPackage(userId, packageId);

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    if (service.providerId !== provider.id) {
      throw new ForbiddenException(
        'A package can only contain services owned by the same provider (docs/packages-implementation-plan.md §2.3)',
      );
    }
    if (service.isPackaged) {
      throw new BadRequestException('Cannot attach a package-exclusive service — it already belongs to another package');
    }
    if (service.approvalStatus !== 'ACTIVE') {
      throw new BadRequestException('Only an approved, active service can be attached to a package');
    }

    const existing = await this.prisma.packageItem.findUnique({
      where: { packageId_serviceId: { packageId, serviceId: dto.serviceId } },
    });
    if (existing) {
      throw new BadRequestException('This service is already attached to the package');
    }

    const item = await this.prisma.packageItem.create({
      data: {
        packageId,
        serviceId: dto.serviceId,
        isRequired: dto.isRequired ?? true,
        addedByUserId: userId,
      },
    });

    // Composition changed — any active discount on this package needs the
    // provider's fresh sign-off before it applies again (docs/discounts-implementation-plan.md §3).
    await this.discountsService.suspendDiscountsForPackage(packageId);

    return { message: 'Service attached to package successfully', data: item };
  }

  /** Any PackageBooking not yet COMPLETED/CANCELLED (docs §9's "active booking" definition). */
  private async hasActivePackageBookings(packageId: string) {
    const count = await this.prisma.packageBooking.count({
      where: { packageId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
    return count > 0;
  }

  /**
   * Removal — the Hall can never be removed this way (docs §8.1). A non-Hall
   * removal is deferred via PackageChangeRequest when the package is ACTIVE
   * with active bookings (docs §9); it applies immediately otherwise. Adding
   * a service is always safe to apply immediately (a new optional item can
   * never invalidate a booking that already committed to a smaller
   * selection), so only removal needs this deferral path.
   */
  async removeService(userId: string, packageId: string, serviceId: string) {
    const { package: pkg } = await this.getOwnedPackage(userId, packageId);

    const detail = await this.composeDetail(packageId);
    const target = detail.services.find((s) => s.id === serviceId);
    if (!target) throw new NotFoundException('This service is not part of the package');

    if (this.isHallService(detail.services as any, serviceId)) {
      throw new BadRequestException(
        'The Hall service can never be removed from a package — delete the entire package instead (docs/packages-implementation-plan.md §8.1)',
      );
    }

    if (pkg.status === PackageStatus.ACTIVE && (await this.hasActivePackageBookings(packageId))) {
      await this.prisma.packageChangeRequest.upsert({
        where: { packageId },
        update: { payload: { removeServiceId: serviceId }, status: PackageChangeStatus.PENDING, requestedByUserId: userId },
        create: { packageId, payload: { removeServiceId: serviceId }, status: PackageChangeStatus.PENDING, requestedByUserId: userId },
      });

      return {
        message:
          'Package has active bookings — this change has been scheduled and will apply automatically once they complete',
        data: null,
      };
    }

    if (target.membershipType === 'EXCLUSIVE') {
      await this.prisma.service.delete({ where: { id: serviceId } });
    } else {
      await this.prisma.packageItem.delete({
        where: { packageId_serviceId: { packageId, serviceId } },
      });
    }

    await this.discountsService.suspendDiscountsForPackage(packageId);

    return { message: 'Service removed from package successfully', data: null };
  }

  /**
   * Cancel a scheduled non-Hall edit before it applies (docs §9).
   */
  async cancelPendingChange(userId: string, packageId: string) {
    await this.getOwnedPackage(userId, packageId);

    const pending = await this.prisma.packageChangeRequest.findUnique({ where: { packageId } });
    if (!pending || pending.status !== PackageChangeStatus.PENDING) {
      throw new NotFoundException('No pending scheduled change for this package');
    }

    await this.prisma.packageChangeRequest.update({
      where: { id: pending.id },
      data: { status: PackageChangeStatus.CANCELLED },
    });

    return { message: 'Scheduled change cancelled', data: null };
  }

  /**
   * Called once a PackageBooking reaches a terminal status (docs §9) — applies
   * a pending scheduled edit if no other active booking remains for the
   * package. No-op if there's nothing pending or bookings are still active.
   *
   * TODO(Phase 6): wire this from a listener on the package-booking-completed/
   * cancelled event once PackageBooking has a real creation flow — there is
   * nothing to trigger it from yet, so this is dead code in practice until then.
   */
  async applyPendingChangeIfEligible(packageId: string) {
    if (await this.hasActivePackageBookings(packageId)) return;

    const pending = await this.prisma.packageChangeRequest.findUnique({ where: { packageId } });
    if (!pending || pending.status !== PackageChangeStatus.PENDING) return;

    const payload = pending.payload as { removeServiceId?: string };
    if (payload.removeServiceId) {
      const service = await this.prisma.service.findUnique({ where: { id: payload.removeServiceId } });
      if (service) {
        if (service.isPackaged) {
          await this.prisma.service.delete({ where: { id: service.id } });
        } else {
          await this.prisma.packageItem.deleteMany({ where: { packageId, serviceId: service.id } });
        }
      }
    }

    await this.prisma.packageChangeRequest.update({
      where: { id: pending.id },
      data: { status: PackageChangeStatus.APPLIED, appliedAt: new Date() },
    });

    await this.discountsService.suspendDiscountsForPackage(packageId);

    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: { provider: { include: { user: true } } },
    });
    if (pkg) {
      this.domainEventBus.packageChangeApplied({
        actorId: pending.requestedByUserId,
        targetUserId: pkg.provider.userId,
        entityId: pkg.id,
        packageId: pkg.id,
        packageName: pkg.name,
      });
    }
  }

  // ── submission (docs §7) ────────────────────────────────────

  async submitPackage(userId: string, packageId: string) {
    const { package: pkg } = await this.getOwnedPackage(userId, packageId);

    if (pkg.status !== PackageStatus.DRAFT && pkg.status !== PackageStatus.REJECTED) {
      throw new BadRequestException(`Package cannot be submitted while it is ${pkg.status}`);
    }

    const detail = await this.composeDetail(packageId);

    if (detail.services.length === 0) {
      throw new BadRequestException('Package must include at least one service');
    }

    if (pkg.pricingStrategy === PackagePricingStrategy.GUEST_BASED) {
      const hallServices = detail.services.filter((s) => (s as any).serviceType.isVenue);

      if (hallServices.length !== 1) {
        throw new BadRequestException(
          hallServices.length === 0
            ? 'Package must include exactly one approved Hall service'
            : 'Package must include exactly one Hall service, not more than one',
        );
      }
      if (hallServices[0].approvalStatus !== 'ACTIVE') {
        throw new BadRequestException('The package\'s Hall service must be an approved (ACTIVE) service');
      }
      if (detail.services.length < 2) {
        throw new BadRequestException('Package must include at least one service besides the Hall');
      }
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { status: PackageStatus.PENDING_APPROVAL, reviewNote: null, reviewedById: null, reviewedAt: null },
    });

    return { message: 'Package submitted for admin review', data: updated };
  }

  // ── public browse / detail / price-quote (docs §5.5, §10, §11) ─

  /** True if `service` is a Hall (ServiceType.isVenue) with a resolvable capacity/price. */
  private findHall(services: any[]) {
    return services.find((s) => s.serviceType?.isVenue);
  }

  private hallPriceFor(hall: any, guestCount: number) {
    if (hall.priceType === 'PER_GUEST') {
      return (hall.price ?? 0) * guestCount;
    }
    return hall.price ?? 0;
  }

  async listPublicPackages(query: PaginationDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = { status: PackageStatus.ACTIVE };

    const [packages, total] = await this.prisma.$transaction([
      this.prisma.package.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          exclusiveServices: { include: { serviceType: true } },
          attachedItems: { include: { service: { include: { serviceType: true } } } },
        },
      }),
      this.prisma.package.count({ where }),
    ]);

    const items = packages.map((pkg) => {
      const { exclusiveServices, attachedItems, ...rest } = pkg;
      const services = [
        ...exclusiveServices,
        ...attachedItems.map((i) => i.service),
      ];

      // Indicative "starting from" price — live estimate, never cached/stored
      // (docs §11.3): Hall at its own minimum guest count, no optional add-ons.
      let startingPrice: number | null = null;
      if (pkg.pricingStrategy === PackagePricingStrategy.GUEST_BASED) {
        const hall = this.findHall(services);
        if (hall) {
          startingPrice = this.hallPriceFor(hall, hall.minCapacity ?? 1);
        }
      } else {
        startingPrice = services.reduce((sum, s: any) => sum + (s.price ?? 0), 0);
      }

      return { ...rest, startingPrice, serviceCount: services.length };
    });

    return {
      message: 'Packages retrieved successfully',
      data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    };
  }

  async getPublicPackageDetail(packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.status !== PackageStatus.ACTIVE) {
      throw new NotFoundException('Package not found');
    }

    const detail = await this.composeDetail(packageId);
    return { message: 'Package retrieved successfully', data: detail };
  }

  /**
   * Shared pricing core for both the live price-quote endpoint and actual
   * booking creation (docs §11, §12.3) — the two must never compute this
   * differently.
   */
  private computePricing(
    pkg: { pricingStrategy: PackagePricingStrategy },
    services: any[],
    guestCountInput: number | undefined,
    optionalServiceIdsInput: string[] | undefined,
  ) {
    const requiredServices = services.filter((s) => s.isRequired);
    const optionalServices = services.filter((s) => !s.isRequired);

    let hallPrice = 0;
    let guestCount = guestCountInput ?? 0;
    let hall: any = null;

    if (pkg.pricingStrategy === PackagePricingStrategy.GUEST_BASED) {
      hall = this.findHall(requiredServices);
      if (!hall) throw new BadRequestException('Package has no Hall service to price against');
      if (!guestCountInput) {
        throw new BadRequestException('guestCount is required for a GUEST_BASED package');
      }
      if (hall.minCapacity && guestCount < hall.minCapacity) {
        throw new BadRequestException(`guestCount must be at least ${hall.minCapacity}`);
      }
      if (hall.maxCapacity && guestCount > hall.maxCapacity) {
        throw new BadRequestException(`guestCount cannot exceed ${hall.maxCapacity}`);
      }
      hallPrice = this.hallPriceFor(hall, guestCount);
    } else {
      // FLAT_SUM: every required item's own price, guest count not applicable
      hallPrice = requiredServices.reduce((sum, s) => sum + (s.price ?? 0), 0);
      guestCount = 0;
    }

    const selectedOptionalIds = new Set(optionalServiceIdsInput ?? []);
    const selectedOptional = optionalServices.filter((s) => selectedOptionalIds.has(s.id));
    const invalidIds = [...selectedOptionalIds].filter((id) => !optionalServices.some((s) => s.id === id));
    if (invalidIds.length) {
      throw new BadRequestException(`Not a valid optional item for this package: ${invalidIds.join(', ')}`);
    }

    // For GUEST_BASED, a required item other than the Hall itself (e.g. a
    // package-exclusive add-on marked isRequired=true) is priced at its own
    // flat price and folded in here — verified live: without this, such an
    // item's price silently vanished from the subtotal entirely. The
    // `optionalServicesTotal` field name predates this case but still
    // correctly represents "everything beyond the Hall's own price."
    const otherRequiredTotal =
      pkg.pricingStrategy === PackagePricingStrategy.GUEST_BASED
        ? requiredServices.filter((s) => s.id !== hall?.id).reduce((sum, s) => sum + (s.price ?? 0), 0)
        : 0;

    const optionalServicesTotal = otherRequiredTotal + selectedOptional.reduce((sum, s) => sum + (s.price ?? 0), 0);
    const subtotal = hallPrice + optionalServicesTotal;

    return { requiredServices, selectedOptional, hall, guestCount, hallPrice, optionalServicesTotal, subtotal };
  }

  async getPriceQuote(packageId: string, query: PriceQuoteQueryDto) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.status !== PackageStatus.ACTIVE) {
      throw new NotFoundException('Package not found');
    }

    const detail = await this.composeDetail(packageId);
    const { guestCount, hallPrice, optionalServicesTotal, subtotal, selectedOptional } = this.computePricing(
      pkg,
      detail.services as any[],
      query.guestCount,
      query.optionalServiceIds,
    );

    // Discount applied AFTER subtotal, the package's own discount only —
    // never combined with a component service's own discount (docs §4, §11.1 step 4).
    const discount = await this.discountsService.resolveActiveDiscountForPackage(packageId, query.discountCode);
    const discountAmount = discount ? subtotal * (discount.percentOff / 100) : 0;

    return {
      message: 'Price quote calculated successfully',
      data: {
        guestCount: pkg.pricingStrategy === PackagePricingStrategy.GUEST_BASED ? guestCount : null,
        hallPrice,
        optionalServicesTotal,
        selectedOptionalServiceIds: selectedOptional.map((s) => s.id),
        subtotal,
        discountAmount,
        totalAmount: subtotal - discountAmount,
      },
    };
  }

  // ── booking (docs §12) ──────────────────────────────────────

  /** Any PackageBooking that hasn't reached a terminal status. */
  private isPackageBookingActive(status: string) {
    return status !== 'COMPLETED' && status !== 'CANCELLED';
  }

  async bookPackage(userId: string, packageId: string, dto: CreatePackageBookingDto) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.status !== PackageStatus.ACTIVE) {
      throw new NotFoundException('Package not found');
    }

    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
      if (!event || event.customerId !== userId) {
        throw new BadRequestException('eventId must reference one of your own events');
      }
    }

    const detail = await this.composeDetail(packageId);
    const services = detail.services as any[];

    const { requiredServices, selectedOptional, guestCount, hallPrice, optionalServicesTotal, subtotal } =
      this.computePricing(pkg, services, dto.guestCount, dto.optionalServiceIds);

    const includedServices = [...requiredServices, ...selectedOptional];

    // Availability re-check (docs §12.6) — every included service's own
    // provider must have no conflicting BlockedSlot on the event date.
    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
      if (event) {
        const conflicts = await this.prisma.blockedSlot.findMany({
          where: {
            serviceId: { in: includedServices.map((s) => s.id) },
            date: event.eventDate,
          },
        });
        if (conflicts.length) {
          throw new BadRequestException('One or more included services are unavailable on the requested date');
        }
      }
    }

    // Discount resolved and frozen here, before payment — the package's own
    // discount only, applied after subtotal (docs §4, §11.1, §12.3 step 4).
    const discount = await this.discountsService.resolveActiveDiscountForPackage(packageId, dto.discountCode);
    const discountAmount = discount ? subtotal * (discount.percentOff / 100) : 0;
    const totalAmount = subtotal - discountAmount;

    const lineAmount = (service: any) =>
      service.isRequired && service.serviceType?.isVenue ? hallPrice : (service.price ?? 0);

    const result = await this.prisma.$transaction(async (tx) => {
      const packageBooking = await tx.packageBooking.create({
        data: {
          packageId,
          customerId: userId,
          eventId: dto.eventId,
          guestCount,
          status: 'PENDING_PAYMENT',
          hallPrice,
          optionalServicesTotal,
          subtotal,
          discountId: discount?.id,
          discountAmount: discount ? discountAmount : undefined,
          totalAmount,
        },
      });

      await tx.packageBookingItem.createMany({
        data: includedServices.map((s) => ({
          packageBookingId: packageBooking.id,
          serviceId: s.id,
          wasRequired: s.isRequired,
          priceAtBooking: lineAmount(s),
        })),
      });

      // One Booking per included service, already CONFIRMED — price and
      // inclusion were already settled during configuration, so this is a
      // fixed-price "instant book," not a quote negotiation (docs §12.3).
      // The discount is apportioned pro-rata across the lines by their share
      // of the pre-discount subtotal (docs §12.4's worked formula) — each
      // child Payment will simply charge this frozen finalAmount later.
      for (const service of includedServices) {
        const priceAtBooking = lineAmount(service);
        const share = subtotal > 0 ? priceAtBooking / subtotal : 0;
        const finalAmount = priceAtBooking - discountAmount * share;

        await tx.booking.create({
          data: {
            customerId: userId,
            providerId: service.providerId,
            serviceId: service.id,
            eventId: dto.eventId,
            packageBookingId: packageBooking.id,
            totalAmount: priceAtBooking,
            finalAmount,
            status: 'CONFIRMED',
          },
        });
      }

      return packageBooking;
    });

    // Mirrors the standalone flow (docs/delivery-implementation-plan.md §3) —
    // run after commit, once each child Booking is actually visible; a
    // no-op for any service whose type doesn't require delivery.
    const childBookings = await this.prisma.booking.findMany({
      where: { packageBookingId: result.id },
      select: { id: true },
    });
    for (const b of childBookings) {
      await this.deliveryService.createIfRequired(b.id);
    }

    return { message: 'Package booked successfully — proceed to payment', data: result };
  }

  async getPackageBookingById(userId: string, packageBookingId: string) {
    const pb = await this.prisma.packageBooking.findUnique({
      where: { id: packageBookingId },
      include: { bookings: { include: { payment: true, service: { include: { serviceType: true } } } }, package: true },
    });
    if (!pb) throw new NotFoundException('Package booking not found');
    if (pb.customerId !== userId) throw new ForbiddenException('Access denied');

    return { message: 'Package booking retrieved successfully', data: pb };
  }

  /** Cancellation is only possible before payment completes (docs §12.5). */
  async cancelPackageBooking(userId: string, packageBookingId: string, reason?: string) {
    const pb = await this.prisma.packageBooking.findUnique({ where: { id: packageBookingId } });
    if (!pb) throw new NotFoundException('Package booking not found');
    if (pb.customerId !== userId) throw new ForbiddenException('Access denied');

    if (pb.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        'A package booking can only be cancelled before payment completes (docs/packages-implementation-plan.md §12.5)',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.packageBooking.update({
        where: { id: packageBookingId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
      });
      await tx.booking.updateMany({
        where: { packageBookingId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'CUSTOMER', cancellationReason: reason },
      });
    });

    return { message: 'Package booking cancelled', data: null };
  }

  /**
   * Called by PaymentsService once a package-sourced booking's payment
   * clears (docs §12.4) — advances PackageBooking → CONFIRMED and every
   * child Booking → IN_PROGRESS together, once *all* of them are paid.
   */
  async tryProgressPackageBooking(packageBookingId: string) {
    const pb = await this.prisma.packageBooking.findUnique({
      where: { id: packageBookingId },
      include: { bookings: { include: { payment: true } } },
    });
    if (!pb || pb.status !== 'PENDING_PAYMENT') return;

    const allPaid = pb.bookings.length > 0 && pb.bookings.every((b) => b.payment?.status === 'PAID');
    if (!allPaid) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { packageBookingId },
        data: { status: 'IN_PROGRESS', acceptedAt: new Date() },
      });
      await tx.packageBooking.update({ where: { id: packageBookingId }, data: { status: 'CONFIRMED' } });
    });
  }
}
