// src/modules/bookings/bookings.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { DeliveryService } from '../delivery/delivery.service';
import { BulkQuoteDecisionDto, BulkQuotePaymentMethod } from './dto/bulk-quote-decision.dto';
import { CONFIRMED_UNPAID_TIMEOUT_HOURS } from 'src/common/constants/booking.constants';

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'];
const PENDING_STATUSES = ['PENDING', 'QUOTE_SENT'];
const PAYMENT_METHOD_LABELS: Record<BulkQuotePaymentMethod, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash - Payment in Progress',
};

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
      data: { status: 'CONFIRMED',
      cancellationDeadline: new Date(Date.now() + CONFIRMED_UNPAID_TIMEOUT_HOURS * 60 * 60 * 1000),
       },
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
      eventId: booking.eventId ?? undefined,
    });

    const message = 'Quote confirmed successfully';
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
    // Any sibling still pending/quote_sent → event stays DRAFT.
    // Otherwise remaining siblings are CONFIRMED (pending payment) or
    // IN_PROGRESS → tryProgressEvent below decides if they can now advance.
    const newEventStatus = allSiblingsTerminal
      ? 'CANCELLED'
      : hasPendingSibling
        ? 'DRAFT'
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

    // if (!newEventStatus) {
    //   // Removing this (now-terminal) booking may have been the last thing
    //   // blocking the remaining, already-paid siblings from starting.
    //   await this.tryProgressEvent(booking.event.id);
    // }

    const finalEvent = await this.prisma.event.findUnique({ where: { id: booking.event.id } });

    // Notify provider that their quote was rejected
    this.domainEventBus.bookingRejected({
      actorId: customerId,
      targetUserId: booking.provider.user.id,
      entityId: bookingId,
      bookingId,
      serviceName: booking.service.serviceType.name,
      rejectionReason: 'Customer rejected the quote',
      eventId: booking.eventId ?? undefined,
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

  // ─────────────────────────────────────────────────────────────
  // PATCH /events/:eventId/bookings/quote-decisions
  // ─────────────────────────────────────────────────────────────
  async bulkQuoteDecision(customerId: string, eventId: string, dto: BulkQuoteDecisionDto) {
    if (dto.eventId !== eventId) {
      throw new BadRequestException('eventId in the request body must match the event in the URL');
    }

    const acceptedIds = [...new Set(dto.acceptedBookingIds ?? [])];
    const rejectedIds = [...new Set(dto.rejectedBookingIds ?? [])];
    const allIds = [...new Set([...acceptedIds, ...rejectedIds])];

    const overlap = acceptedIds.filter((id) => rejectedIds.includes(id));
    if (overlap.length > 0) {
      throw new BadRequestException(
        `A booking cannot appear in both acceptedBookingIds and rejectedBookingIds: ${overlap.join(', ')}`,
      );
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, customerId: true, name: true, eventDate: true, status: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.customerId !== customerId) {
      throw new ForbiddenException('Access denied — not your event');
    }

    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: allIds }, eventId },
      include: {
        service: { include: { serviceType: { select: { name: true, requiresDeliveryByDefault: true } } } },
        provider: { include: { user: { select: { id: true } } } },
        payment: true,
        event: { select: { eventDate: true, eventLocation: true } },
      },
    });

    if (bookings.length !== allIds.length) {
      const found = new Set(bookings.map((b) => b.id));
      const missing = allIds.filter((id) => !found.has(id));
      throw new BadRequestException(
        `Every booking ID must belong to the specified event. Not found or mismatched: ${missing.join(', ')}`,
      );
    }

    const notQuoteSent = bookings.filter((b) => b.status !== 'QUOTE_SENT');
    if (notQuoteSent.length > 0) {
      throw new BadRequestException(
        `Every booking must be in QUOTE_SENT status. Invalid: ${notQuoteSent.map((b) => `${b.id} (${b.status})`).join(', ')}`,
      );
    }

    const acceptedBookings = bookings.filter((b) => acceptedIds.includes(b.id));
    const rejectedBookings = bookings.filter((b) => rejectedIds.includes(b.id));
    const method = dto.method as BulkQuotePaymentMethod | undefined;
    const paymentMethodLabel = method ? PAYMENT_METHOD_LABELS[method] : undefined;

    const alreadyPaid = acceptedBookings.filter((b) => b.payment);
    if (alreadyPaid.length > 0) {
      throw new BadRequestException(
        `Payment already exists for booking(s): ${alreadyPaid.map((b) => b.id).join(', ')}`,
      );
    }

    let eventCancelled = false;

    await this.prisma.$transaction(async (tx) => {
      for (const booking of acceptedBookings) {
        const isBankTransfer = method === 'BANK_TRANSFER';
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CONFIRMED',
            cancellationDeadline: isBankTransfer
              ? null
              : new Date(Date.now() + CONFIRMED_UNPAID_TIMEOUT_HOURS * 60 * 60 * 1000),
          },
        });

        const subtotalAmount = booking.finalAmount ?? booking.totalAmount;

        await tx.payment.create({
          data: {
            bookingId: booking.id,
            payerId: customerId,
            amount: subtotalAmount,
            subtotalAmount,
            method: method as PaymentMethod,
            status: isBankTransfer ? PaymentStatus.PAID : PaymentStatus.PROCESSING,
            ...(isBankTransfer && {
              paidAt: new Date(),
              providerReference: `MOCK-BT-${booking.id}-${Date.now()}`,
            }),
          },
        });

        if (booking.service.serviceType.requiresDeliveryByDefault) {
          const existingDelivery = await tx.delivery.findUnique({ where: { bookingId: booking.id } });
          if (!existingDelivery) {
            await tx.delivery.create({
              data: {
                bookingId: booking.id,
                status: 'SCHEDULED',
                address: booking.event?.eventLocation ?? '',
                scheduledAt: booking.event?.eventDate,
              },
            });
          }
        }
      }

      const rejectionReason = dto.rejectionReason?.trim();
      for (const booking of rejectedBookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: 'CUSTOMER',
            cancellationReason: rejectionReason || 'Customer rejected the quote',
            ...(rejectionReason && { rejectionReason }),
          },
        });
      }

      const eventBookings = await tx.booking.findMany({
        where: { eventId },
        select: { status: true },
      });

      const allCancelledOrRejected = eventBookings.every(
        (b) => b.status === 'CANCELLED' || b.status === 'REJECTED',
      );

      if (allCancelledOrRejected && eventBookings.length > 0) {
        await tx.event.update({
          where: { id: eventId },
          data: { status: 'CANCELLED' },
        });
        eventCancelled = true;
      }
    });

    for (const booking of acceptedBookings) {
      this.domainEventBus.bookingAccepted({
        actorId: customerId,
        targetUserId: booking.provider.user.id,
        entityId: booking.id,
        eventId: booking.eventId ?? undefined,
        bookingId: booking.id,
        serviceName: booking.service.serviceType.name,
        eventDate: event.eventDate,
        paymentMethodLabel,
      });
    }

    const rejectionNotificationReason = dto.rejectionReason?.trim();
    for (const booking of rejectedBookings) {
      this.domainEventBus.bookingRejected({
        actorId: customerId,
        targetUserId: booking.provider.user.id,
        entityId: booking.id,
        eventId: booking.eventId ?? undefined,
        bookingId: booking.id,
        serviceName: booking.service.serviceType.name,
        rejectionReason: rejectionNotificationReason || 'Customer rejected the quote',
      });
    }

    if (eventCancelled) {
      this.domainEventBus.eventCancelled({
        actorId: customerId,
        targetUserId: customerId,
        entityId: eventId,
        eventId,
        eventName: event.name,
        reason: 'all services were rejected or cancelled',
      });
    }

    if (method === 'BANK_TRANSFER') {
for (const booking of acceptedBookings) {
        await this.progressBookingAndEvent(booking.id, eventId);
      }
        }

    const message = await this.buildBulkDecisionMessage(eventId, event.eventDate, eventCancelled);

    const updatedBookings = await this.prisma.booking.findMany({
      where: { id: { in: allIds } },
      select: { id: true, status: true },
    });

    const finalEvent = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { status: true },
    });

    return {
      message,
      data: {
        eventId,
        eventStatus: finalEvent?.status,
        acceptedBookingIds: acceptedIds,
        rejectedBookingIds: rejectedIds,
        bookings: updatedBookings,
      },
    };
  }

  private async buildBulkDecisionMessage(
    eventId: string,
    eventDate: Date,
    eventCancelled: boolean,
  ): Promise<string> {
    if (eventCancelled) {
      return 'All bookings were cancelled or rejected — the event has been cancelled.';
    }

    const messages: string[] = ['Quote decisions processed successfully.'];

    const allFinalized = await this.evaluateEventFinalization(eventId);
    if (allFinalized) {
      messages.push(
        'All bookings have been finalized. No further booking cancellations are allowed. ' +
          'Please ensure all payments are completed before confirming the event.',
      );
    }

    const daysUntilEvent = (eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if ( daysUntilEvent >= 4) {
      messages.push('You can still add more bookings to this event.');
    }

    return messages.join(' ');
  }

  private async evaluateEventFinalization(eventId: string): Promise<boolean> {
    const bookings = await this.prisma.booking.findMany({
      where: { eventId },
      select: { status: true },
    });
    if (bookings.length === 0) return false;
    return bookings.every((b) => !PENDING_STATUSES.includes(b.status));
  }

  // src/modules/bookings/bookings.service.ts

  /**
   * Called once a booking's payment clears. Policy (revised): the event is
   * confirmed (ACTIVE → IN_PROGRESS) on the FIRST booking that gets paid,
   * not once every sibling is settled. That specific booking also flips
   * from CONFIRMED to IN_PROGRESS immediately; siblings keep their own
   * independent lifecycle until they, too, get paid.
   */
  async progressBookingAndEvent(bookingId: string, eventId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { include: { serviceType: { select: { name: true } } } },
        provider: { include: { user: { select: { id: true } } } },
      },
    });
    if (!booking || booking.status !== 'CONFIRMED') return;

    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'IN_PROGRESS', acceptedAt: new Date() },
      });
      if (event.status === 'DRAFT') {
        await tx.event.update({ where: { id: eventId }, data: { status: 'IN_PROGRESS' } });
      }
    });

    this.domainEventBus.bookingAccepted({
      actorId: booking.customerId,
      targetUserId: booking.provider.user.id,
      entityId: booking.id,
      bookingId: booking.id,
      eventId: booking.eventId ?? undefined,
      serviceName: booking.service.serviceType.name,
      eventDate: event.eventDate,
    });
  }
  
}
