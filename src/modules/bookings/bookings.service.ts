// src/modules/bookings/bookings.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // PATCH /bookings/:bookingId/confirm-quote
  // ─────────────────────────────────────────────────────────────
  async confirmQuote(customerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId, status: 'QUOTE_SENT' },
      include: {
        event: true,
        service: { include: { serviceType: { select: { name: true } } } },
        provider: { include: { user: { select: { id: true } } } },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        'Booking not found or not awaiting confirmation',
      );
    }

    // Find all OTHER bookings in the same event
    const siblings = await this.prisma.booking.findMany({
      where: { eventId: booking.eventId, id: { not: bookingId } },
      select: { id: true, status: true },
    });

    // A sibling is "done" if customer has already confirmed it or it ended
    const doneSiblingStatuses = [
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'REJECTED',
    ];
    const allSiblingsDone = siblings.every((s) =>
      doneSiblingStatuses.includes(s.status),
    );

    // If every other booking is effectively done → the whole event can start
    const newBookingStatus = allSiblingsDone ? 'IN_PROGRESS' : 'CONFIRMED';
    const newEventStatus  = allSiblingsDone ? 'IN_PROGRESS' : 'ACTIVE';

    await this.prisma.$transaction(async (tx) => {
      // Update this booking
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: newBookingStatus,
          acceptedAt: newBookingStatus === 'IN_PROGRESS' ? new Date() : undefined,
        },
      });

      // If event is now fully confirmed, move every CONFIRMED sibling to IN_PROGRESS
      if (allSiblingsDone) {
        await tx.booking.updateMany({
          where: { eventId: booking.eventId, status: 'CONFIRMED' },
          data: { status: 'IN_PROGRESS', acceptedAt: new Date() },
        });
      }

      // Update event status
      await tx.event.update({
        where: { id: booking.eventId },
        data: { status: newEventStatus },
      });
    });

    // Notify provider that customer confirmed
    this.domainEventBus.bookingAccepted({
      actorId: customerId,
      targetUserId: booking.provider.user.id,
      entityId: bookingId,
      bookingId,
      serviceName: booking.service.serviceType.name,
      eventDate: booking.event.eventDate,
    });

    const message =
      newBookingStatus === 'IN_PROGRESS'
        ? 'All services confirmed — event is now in progress!'
        : 'Quote confirmed — waiting for other services to be confirmed';

    return {
      message,
      data: {
        bookingId,
        bookingStatus: newBookingStatus,
        eventId: booking.eventId,
        eventStatus: newEventStatus,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PATCH /bookings/:bookingId/reject-quote
  // ─────────────────────────────────────────────────────────────
  async rejectQuote(customerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId, status: 'QUOTE_SENT' },
      include: {
        event: { select: { eventDate: true } },
        service: { include: { serviceType: { select: { name: true } } } },
        provider: { include: { user: { select: { id: true } } } },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        'Booking not found or not in QUOTE_SENT status',
      );
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: 'CUSTOMER',
        cancellationReason: 'Customer rejected the provider quote',
      },
    });

    // Notify provider
    this.domainEventBus.bookingRejected({
      actorId: customerId,
      targetUserId: booking.provider.user.id,
      entityId: bookingId,
      bookingId,
      serviceName: booking.service.serviceType.name,
      rejectionReason: 'Customer rejected the quote',
    });

    return {
      message: 'Quote rejected — booking cancelled',
      data: { bookingId, status: 'CANCELLED' },
    };
  }
}