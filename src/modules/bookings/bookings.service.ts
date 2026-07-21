// src/modules/bookings/bookings.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { DeliveryService } from '../delivery/delivery.service';

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'];
const PENDING_STATUSES = ['PENDING', 'QUOTE_SENT'];

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
    private readonly deliveryService: DeliveryService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Shared event-progression logic
  //
  // A booking only counts as "settled" once it's CONFIRMED **and paid**
  // (docs/payments-implementation-plan.md §7 — Payment is a real gate on
  // booking progression, not just a recorded fact), or it's already
  // IN_PROGRESS/terminal. The whole event advances to IN_PROGRESS only once
  // every one of its bookings is settled. Two different actions can be the
  // last domino — the customer confirming the last quote, or a payment
  // clearing on an already-confirmed booking — so both call this same
  // method rather than duplicating the cascade logic.
  // ─────────────────────────────────────────────────────────────
  private async isPaid(bookingId: string): Promise<boolean> {
    const payment = await this.prisma.payment.findUnique({ where: { bookingId } });
    return payment?.status === 'PAID';
  }

  async tryProgressEvent(eventId: string): Promise<void> {
    const bookings = await this.prisma.booking.findMany({
      where: { eventId },
      select: { id: true, status: true },
    });
    if (bookings.length === 0) return;

    const settledFlags = await Promise.all(
      bookings.map(async (b) => {
        if (b.status === 'CONFIRMED') return this.isPaid(b.id);
        return TERMINAL_STATUSES.includes(b.status) || b.status === 'IN_PROGRESS';
      }),
    );

    if (!settledFlags.every(Boolean)) return; // still waiting on someone

    const toAdvanceIds = bookings
      .filter((b, i) => b.status === 'CONFIRMED' && settledFlags[i])
      .map((b) => b.id);

    if (toAdvanceIds.length === 0) return; // nothing left to flip — event may already be IN_PROGRESS

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { id: { in: toAdvanceIds } },
        data: { status: 'IN_PROGRESS', acceptedAt: new Date() },
      });
      await tx.event.update({ where: { id: eventId }, data: { status: 'IN_PROGRESS' } });
    });
  }

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

    // Quote confirmation always lands on CONFIRMED — it can no longer jump
    // straight to IN_PROGRESS even if every sibling is already settled,
    // because payment for *this* booking hasn't happened yet at this point
    // (docs/payments-implementation-plan.md §4 — Payment is created once
    // Booking.status → CONFIRMED, i.e. after this call, not before).
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
    });

    // Mirrors when Payment is created for the same booking
    // (docs/delivery-implementation-plan.md §3) — no-op if the service's
    // type doesn't require delivery.
    await this.deliveryService.createIfRequired(bookingId);

    if (booking.eventId) {
      await this.tryProgressEvent(booking.eventId);
    }

    const updated = await this.prisma.booking.findUnique({ where: { id: bookingId } });

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
      updated?.status === 'IN_PROGRESS'
        ? 'All services confirmed and paid — event is now in progress!'
        : 'Quote confirmed — waiting for payment and/or other services to be confirmed';

    return {
      message,
      data: {
        bookingId,
        bookingStatus: updated?.status ?? 'CONFIRMED',
        eventId: booking.eventId,
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
        event: { select: { id: true, name: true } },
        service: { include: { serviceType: { select: { name: true } } } },
        provider: { include: { user: { select: { id: true } } } },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        'Booking not found or not in QUOTE_SENT status',
      );
    }

    if (!booking.event) {
      throw new BadRequestException('Booking is not associated with an event');
    }

    // Siblings = every other booking under the same event
    const siblings = await this.prisma.booking.findMany({
      where: { eventId: booking.event.id, id: { not: bookingId } },
      select: { status: true },
    });

    const allSiblingsTerminal = siblings.every((s) =>
      TERMINAL_STATUSES.includes(s.status),
    );
    const hasPendingSibling = siblings.some((s) =>
      PENDING_STATUSES.includes(s.status),
    );

    // All bookings (including this one) terminal → event is fully cancelled.
    // Any sibling still pending/quote_sent → event stays ACTIVE.
    // Otherwise remaining siblings are CONFIRMED (pending payment) or
    // IN_PROGRESS → tryProgressEvent below decides if they can now advance.
    const newEventStatus = allSiblingsTerminal
      ? 'CANCELLED'
      : hasPendingSibling
        ? 'ACTIVE'
        : undefined; // let tryProgressEvent decide — may or may not be able to start yet

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: 'CUSTOMER',
          cancellationReason: 'Customer rejected the quote',
        },
      });

      if (newEventStatus) {
        await tx.event.update({
          where: { id: booking.event!.id },
          data: { status: newEventStatus },
        });
      }
    });

    if (!newEventStatus) {
      // Removing this (now-terminal) booking may have been the last thing
      // blocking the remaining, already-paid siblings from starting.
      await this.tryProgressEvent(booking.event.id);
    }

    const finalEvent = await this.prisma.event.findUnique({ where: { id: booking.event.id } });

    // Notify provider that their quote was rejected
    this.domainEventBus.bookingRejected({
      actorId: customerId,
      targetUserId: booking.provider.user.id,
      entityId: bookingId,
      bookingId,
      serviceName: booking.service.serviceType.name,
      rejectionReason: 'Customer rejected the quote',
    });

    // Notify customer if the whole event was cancelled as a result
    if (finalEvent?.status === 'CANCELLED') {
      this.domainEventBus.eventCancelled({
        actorId: customerId,
        targetUserId: customerId,
        entityId: booking.event.id,
        eventId: booking.event.id,
        eventName: booking.event.name,
        reason: 'all services were rejected or cancelled',
      });
    }

    return {
      message:
        finalEvent?.status === 'CANCELLED'
          ? 'Quote rejected — booking cancelled and event cancelled (no remaining services)'
          : 'Quote rejected — booking cancelled',
      data: {
        bookingId,
        bookingStatus: 'CANCELLED',
        eventId: booking.event.id,
        eventStatus: finalEvent?.status,
      },
    };
  }
}
