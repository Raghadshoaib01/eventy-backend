// src/modules/bookings/booking-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { BookingStatus } from '@prisma/client';

const REASONS: Record<string, { customer: string; provider: string }> = {
  PENDING: {
    customer: 'Provider did not respond to your booking request in time. Please choose another provider.',
    provider: 'You did not respond to this booking request in time.',
  },
  QUOTE_SENT: {
    customer: 'You did not respond to the price quote in time (accept or reject).',
    provider: 'The customer did not respond to your quote in time.',
  },
  CONFIRMED: {
    customer: 'You did not complete the cash payment at the provider location in time.',
    provider: 'The customer did not complete the cash payment in time.',
  },
};

@Injectable()
export class BookingCleanupService {
  private readonly logger = new Logger(BookingCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  /**
   * Expires bookings whose stored cancellationDeadline has passed. The
   * deadline is the single source of truth — it is set/refreshed at every
   * relevant transition (creation, quote sent, cash-confirmed) rather than
   * recomputed here from createdAt on every run.
   */
  @Cron('*/15 * * * *')
  async handleExpiredBookings() {
    const expired = await this.prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'QUOTE_SENT', 'CONFIRMED'] as BookingStatus[] },
        cancellationDeadline: { lte: new Date() },
      },
      include: {
        service: { include: { serviceType: { select: { name: true } } } },
        provider: { include: { user: { select: { id: true } } } },
        payment: { select: { status: true } },
      },
    });

    for (const booking of expired) {
      // A CONFIRMED booking whose payment already cleared should have had its
      // deadline cleared by markPaid — skip defensively in case of a race.
      if (booking.status === 'CONFIRMED' && booking.payment?.status === 'PAID') continue;

      const reasons = REASONS[booking.status];

      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: 'SYSTEM',
          cancellationReason: reasons.provider,
        },
      });

      this.domainEventBus.bookingCancelled({
        actorId: booking.customerId,
        targetUserId: booking.customerId,
        entityId: booking.id,
        bookingId: booking.id,
        serviceName: booking.service.serviceType.name,
        reason: reasons.customer,
      });
      this.domainEventBus.bookingCancelled({
        actorId: booking.customerId,
        targetUserId: booking.provider.user.id,
        entityId: booking.id,
        bookingId: booking.id,
        serviceName: booking.service.serviceType.name,
        reason: reasons.provider,
      });
    }

    if (expired.length) {
      this.logger.log(`Auto-cancelled ${expired.length} expired booking(s)`);
    }
  }
}