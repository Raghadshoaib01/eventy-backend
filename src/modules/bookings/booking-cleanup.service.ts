// src/modules/bookings/booking-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

const PENDING_TIMEOUT_HOURS = 24;
const QUOTE_SENT_TIMEOUT_HOURS = 48;
const CONFIRMED_UNPAID_TIMEOUT_HOURS = 96;

@Injectable()
export class BookingCleanupService {
  private readonly logger = new Logger(BookingCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

 @Cron('*/15 * * * *')
   async handleExpiredBookings() {
    await this.cancelStale('PENDING', PENDING_TIMEOUT_HOURS,
      'Provider did not respond to your booking request in time. Please choose another provider.',
      'You did not respond to this booking request in time.');

    await this.cancelStale('QUOTE_SENT', QUOTE_SENT_TIMEOUT_HOURS,
      'You did not respond to the price quote in time (accept or reject).',
      'The customer did not respond to your quote in time.', { requirePayment: false });

    await this.cancelStale('CONFIRMED', CONFIRMED_UNPAID_TIMEOUT_HOURS,
      'You did not complete the cash payment at the provider location in time.',
      'The customer did not complete the cash payment in time.', { requirePayment: true });
  }

  private cutoff(hours: number): Date {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  private async cancelStale(
    status: 'PENDING' | 'QUOTE_SENT' | 'CONFIRMED',
    hours: number,
    customerReason: string,
    providerReason: string,
    opts: { requirePayment?: boolean } = {},
  ) {
    const where: any = { status, createdAt: { lte: this.cutoff(hours) } };
    if (opts.requirePayment) where.payment = null; // only unpaid CONFIRMED bookings

    const stale = await this.prisma.booking.findMany({
      where,
      include: {
        service: { include: { serviceType: { select: { name: true } } } },
        provider: { include: { user: { select: { id: true } } } },
      },
    });

    for (const booking of stale) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: 'SYSTEM',
          cancellationReason: providerReason,
        },
      });

      this.domainEventBus.bookingCancelled({
        actorId: booking.customerId,
        targetUserId: booking.customerId,
        entityId: booking.id,
        bookingId: booking.id,
        serviceName: booking.service.serviceType.name,
        reason: customerReason,
      });
      this.domainEventBus.bookingCancelled({
        actorId: booking.customerId,
        targetUserId: booking.provider.user.id,
        entityId: booking.id,
        bookingId: booking.id,
        serviceName: booking.service.serviceType.name,
        reason: providerReason,
      });
    }

    if (stale.length) {
      this.logger.log(`Auto-cancelled ${stale.length} stale ${status} booking(s)`);
    }
  }
}