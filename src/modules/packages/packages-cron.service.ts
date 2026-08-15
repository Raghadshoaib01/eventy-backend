// src/modules/packages/packages-cron.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PackageEventBookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

/**
 * ثلاث مهام cron لباقات المزود (packagesNewPlan.txt §21, §8, §9):
 *
 *   1. انتهاء طلبات الانضمام المعلّقة (24h) → PACKAGE_JOIN_EXPIRED
 *   2. انتهاء طلبات الحجز المعلّقة (48h)   → PACKAGE_BOOKING_EXPIRED
 *   3. انتهاء مهلة الدفع (24h)              → PACKAGE_PAYMENT_EXPIRED
 *
 * تعتمد على حقلَي pendingExpiresAt / paymentExpiresAt المخزَّنين على
 * PackageEventBooking نفسه (بدل حساب المهلة من createdAt/updatedAt في كل
 * تشغيل)، بنفس نمط Booking.cancellationDeadline في booking-cleanup.service.ts.
 *
 * أما طلبات الانضمام (PackageService) فلا يوجد بها حقل deadline مخزَّن —
 * تُقاس من createdAt لأنها لا تتحدّث بعد الإنشاء إلا عند القبول/الرفض
 * (فلا خطر تزاحم كما في الحجوزات).
 */
@Injectable()
export class PackagesCronService {
  private readonly logger = new Logger(PackagesCronService.name);
  private readonly JOIN_REQUEST_TIMEOUT_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  @Cron('*/15 * * * *')
  async handlePackageCron(): Promise<void> {
    await Promise.all([
      this.expirePendingJoinRequests(),
      this.expirePendingPackageBookings(),
      this.expireUnpaidPackageBookings(),
      this.completeFinishedPackageBookings(),
    ]);
  }

/** 4. إنهاء تلقائي للحجوزات IN_PROGRESS فور وصول موعد نهاية المناسبة */
private async completeFinishedPackageBookings(): Promise<void> {
  const now = new Date();
  const candidates = await this.prisma.packageEventBooking.findMany({
    where: { status: PackageEventBookingStatus.IN_PROGRESS, eventId: { not: null } },
    include: { event: true },
  });

  let completed = 0;
  for (const pb of candidates) {
    if (!pb.event) continue;

    const [endH, endM] = pb.event.eventEndTime.split(':').map(Number);
    const [startH] = pb.event.eventStartTime.split(':').map(Number);
    const endsNextDay = endH < startH;
    const eventEnd = new Date(pb.event.eventDate);
    eventEnd.setHours(endH, endM, 0, 0);
    if (endsNextDay) eventEnd.setDate(eventEnd.getDate() + 1);

    if (eventEnd > now) continue; // لم يصل موعد الانتهاء بعد

    await this.prisma.$transaction(async (tx) => {
      await tx.packageEventBooking.update({
        where: { id: pb.id },
        data: { status: PackageEventBookingStatus.COMPLETED },
      });
      await tx.booking.updateMany({
        where: { packageEventBookingId: pb.id, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: now },
      });
      await tx.event.update({
        where: { id: pb.event!.id },
        data: { status: 'COMPLETED' },
      });
    });
    completed++;
  }

  if (completed) {
    this.logger.log(`Auto-completed ${completed} package booking(s)`);
  }
}

  /** 1. انتهاء طلبات الانضمام (24h) — PENDING_PROVIDER_APPROVAL → REJECTED */
  private async expirePendingJoinRequests(): Promise<void> {
    const cutoff = new Date(Date.now() - this.JOIN_REQUEST_TIMEOUT_HOURS * 60 * 60 * 1000);

    const stale = await this.prisma.packageService.findMany({
      where: {
        status: 'PENDING_PROVIDER_APPROVAL',
        createdAt: { lt: cutoff },
      },
      include: {
        package: { include: { provider: { include: { user: true } } } },
        provider: { include: { user: true } },
      },
    });

    for (const ps of stale) {
      await this.prisma.packageService.update({
        where: { id: ps.id },
        data: { status: 'REJECTED' },
      });

      // إشعار صاحب الباقة
      this.domainEventBus.packageJoinExpired({
        actorId: 'SYSTEM',
        targetUserId: ps.package.provider.user.id,
        entityId: ps.packageId,
        packageId: ps.packageId,
        packageName: ps.package.name,
      });

      // إشعار المزود الشريك الذي انتهت مهلته
      this.domainEventBus.packageJoinExpired({
        actorId: 'SYSTEM',
        targetUserId: ps.provider.user.id,
        entityId: ps.packageId,
        packageId: ps.packageId,
        packageName: ps.package.name,
      });
    }

    if (stale.length) {
      this.logger.log(`Auto-expired ${stale.length} pending join request(s)`);
    }
  }

  /** 2. انتهاء طلبات الحجز المعلّقة (48h) — PENDING → EXPIRED */
  private async expirePendingPackageBookings(): Promise<void> {
    const stale = await this.prisma.packageEventBooking.findMany({
      where: {
        status: PackageEventBookingStatus.PENDING,
        pendingExpiresAt: { lt: new Date() },
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
          where: { packageEventBookingId: pb.id, status: { in: ['PENDING', 'CONFIRMED'] } },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: 'SYSTEM',
            cancellationReason: 'Package booking request expired (48h timeout)',
          },
        });
      });

      this.domainEventBus.packageBookingExpired({
        actorId: 'SYSTEM',
        targetUserId: pb.customerId,
        entityId: pb.id,
        packageId: pb.packageId,
        packageName: pb.package.name,
        packageEventBookingId: pb.id,
      });
      this.domainEventBus.packageBookingExpired({
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

  /** 3. انتهاء مهلة الدفع (24h) — PENDING_PAYMENT → CANCELLED */
  private async expireUnpaidPackageBookings(): Promise<void> {
    const stale = await this.prisma.packageEventBooking.findMany({
      where: {
        status: PackageEventBookingStatus.PENDING_PAYMENT,
        paymentExpiresAt: { lt: new Date() },
      },
      include: {
        package: { include: { provider: { include: { user: true } } } },
        customer: true,
        payment: true,
      },
    });

    for (const pb of stale) {
      // تجاهل احتياطي إن كان الدفع تم فعلاً (سباق نادر)
      if (pb.payment?.status === PaymentStatus.PAID) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.packageEventBooking.update({
          where: { id: pb.id },
          data: { status: PackageEventBookingStatus.CANCELLED },
        });
        await tx.booking.updateMany({
          where: { packageEventBookingId: pb.id, status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: 'SYSTEM',
            cancellationReason: 'Package booking expired before payment (24h timeout)',
          },
        });
        if (pb.payment && pb.payment.status !== PaymentStatus.PAID) {
          await tx.payment.update({
            where: { id: pb.payment.id },
            data: { status: PaymentStatus.CANCELLED },
          });
        }
      });

      this.domainEventBus.packagePaymentExpired({
        actorId: 'SYSTEM',
        targetUserId: pb.customerId,
        entityId: pb.id,
        packageId: pb.packageId,
        packageName: pb.package.name,
        packageEventBookingId: pb.id,
      });
      this.domainEventBus.packagePaymentExpired({
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