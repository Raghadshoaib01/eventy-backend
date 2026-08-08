// src/modules/packages/packages-cron.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PackageEventBookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import {
  PACKAGE_JOIN_TIMEOUT_HOURS,
  PACKAGE_BOOKING_REQUEST_TIMEOUT_HOURS,
  PACKAGE_PAYMENT_TIMEOUT_HOURS,
} from './packages.constants';

/**
 * Three cron jobs (docs/implementation_plan.md §5):
 *
 *   1. Expire pending package join requests (24h).
 *   2. Expire pending package event bookings (48h).
 *   3. Expire unpaid confirmed package bookings (24h).
 *
 * Runs every 15 minutes — the deadline fields are the single source of
 * truth (mirrors `booking-cleanup.service.ts` pattern).
 */
@Injectable()
export class PackagesCronService {
  private readonly logger = new Logger(PackagesCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  /**
   * Master cron — runs every 15 minutes and dispatches to each sub-job.
   * Splitting them into separate `@Cron` calls would just multiply
   * schedule overhead with no benefit; they share the same DB connection.
   */
  @Cron('*/15 * * * *')
  async handlePackageCron(): Promise<void> {
    await Promise.all([
      this.expirePendingJoinRequests(),
      this.expirePendingPackageBookings(),
      this.expireUnpaidPackageBookings(),
    ]);
  }

  /** 1. Join-request expiry — flips stale PENDING_PROVIDER_APPROVAL to REJECTED. */
  private async expirePendingJoinRequests(): Promise<void> {
    const cutoff = new Date(
      Date.now() - PACKAGE_JOIN_TIMEOUT_HOURS * 60 * 60 * 1000,
    );

    // No rows in the current single-provider-only mode, but the cron
    // exists for forward compatibility when cross-provider joins are
    // re-enabled.
    const stale = await this.prisma.packageService.findMany({
      where: {
        status: 'PENDING_PROVIDER_APPROVAL',
        createdAt: { lt: cutoff },
      },
      include: { package: { include: { provider: { include: { user: true } } } } },
    });

    for (const ps of stale) {
      await this.prisma.packageService.update({
        where: { id: ps.id },
        data: { status: 'REJECTED' },
      });
      this.domainEventBus.packageJoinRejected({
        actorId: 'SYSTEM',
        targetUserId: ps.package.provider.user.id,
        entityId: ps.id,
        packageId: ps.packageId,
        packageName: ps.package.name,
        partnerProviderName: '',
        rejectionReason: 'Join request expired (24h timeout)',
      });
    }
  }

  /** 2. PENDING package-event-booking expiry (48h). */
  private async expirePendingPackageBookings(): Promise<void> {
    const cutoff = new Date(
      Date.now() - PACKAGE_BOOKING_REQUEST_TIMEOUT_HOURS * 60 * 60 * 1000,
    );

    const stale = await this.prisma.packageEventBooking.findMany({
      where: {
        status: PackageEventBookingStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      include: {
        package: { include: { provider: { include: { user: true } } } },
        customer: true,
      },
    });

    for (const pb of stale) {
      await this.prisma.$transaction(async (tx) => {
        await tx.packageEventBooking.update({
          where: { id: pb.id },
          data: { status: PackageEventBookingStatus.EXPIRED },
        });
        await tx.booking.updateMany({
          where: {
            packageEventBookingId: pb.id,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: 'SYSTEM',
            cancellationReason: 'Package booking request expired (48h timeout)',
          },
        });
      });

      this.domainEventBus.packageBookingPaymentExpired({
        actorId: 'SYSTEM',
        targetUserId: pb.customerId,
        entityId: pb.id,
        packageId: pb.packageId,
        packageName: pb.package.name,
        packageEventBookingId: pb.id,
      });
      this.domainEventBus.packageBookingPaymentExpired({
        actorId: 'SYSTEM',
        targetUserId: pb.package.provider.user.id,
        entityId: pb.id,
        packageId: pb.packageId,
        packageName: pb.package.name,
        packageEventBookingId: pb.id,
      });
    }

    if (stale.length) {
      this.logger.log(`Auto-expired ${stale.length} pending package booking(s)`);
    }
  }

  /** 3. Unpaid confirmed package booking expiry (24h). */
  private async expireUnpaidPackageBookings(): Promise<void> {
    const cutoff = new Date(
      Date.now() - PACKAGE_PAYMENT_TIMEOUT_HOURS * 60 * 60 * 1000,
    );

    const stale = await this.prisma.packageEventBooking.findMany({
      where: {
        status: {
          in: [
            PackageEventBookingStatus.PENDING_PAYMENT,
            PackageEventBookingStatus.CONFIRMED,
          ],
        },
        updatedAt: { lt: cutoff },
      },
      include: {
        package: { include: { provider: { include: { user: true } } } },
        customer: true,
        bookings: { include: { payment: true } },
      },
    });

    for (const pb of stale) {
      // Skip package bookings that already have at least one PAID payment
      // (defensive — the customer may have partially paid).
      const anyPaid = pb.bookings.some(
        (b) => b.payment?.status === PaymentStatus.PAID,
      );
      if (anyPaid) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.packageEventBooking.update({
          where: { id: pb.id },
          data: { status: PackageEventBookingStatus.EXPIRED },
        });
        await tx.booking.updateMany({
          where: {
            packageEventBookingId: pb.id,
            status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: 'SYSTEM',
            cancellationReason: 'Package booking expired before payment (24h timeout)',
          },
        });
        await tx.payment.updateMany({
          where: {
            bookingId: { in: pb.bookings.map((b) => b.id) },
            status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
          },
          data: { status: PaymentStatus.CANCELLED },
        });
      });

      this.domainEventBus.packageBookingPaymentExpired({
        actorId: 'SYSTEM',
        targetUserId: pb.customerId,
        entityId: pb.id,
        packageId: pb.packageId,
        packageName: pb.package.name,
        packageEventBookingId: pb.id,
      });
      this.domainEventBus.packageBookingPaymentExpired({
        actorId: 'SYSTEM',
        targetUserId: pb.package.provider.user.id,
        entityId: pb.id,
        packageId: pb.packageId,
        packageName: pb.package.name,
        packageEventBookingId: pb.id,
      });
    }

    if (stale.length) {
      this.logger.log(`Auto-expired ${stale.length} unpaid package booking(s)`);
    }
  }
}
