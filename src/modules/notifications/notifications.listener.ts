// src/modules/notifications/notifications.listener.ts

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import {
  BookingAcceptedPayload,
  BookingCancelledPayload,
  BookingCompletedPayload,
  BookingCreatedPayload,
  BookingRejectedPayload,
  DomainEvents,
  PaymentConfirmedPayload,
  ProviderApprovedPayload,
  ProviderRejectedPayload,
  ServiceApprovedPayload,
  ServiceRejectedPayload,
  UserBlockedPayload,
  UserUnblockedPayload,
  UserVerifiedPayload,
} from 'src/common/events/domain-events';
import { NotificationsService } from './notifications.service';

/**
 * NotificationsListener
 *
 * Listens for all domain events and translates them into
 * NotificationsService.createAndDeliver() calls.
 *
 * Architecture contract:
 *  - Controllers NEVER call this directly.
 *  - Services emit domain events via EventEmitter2.
 *  - This listener reacts and orchestrates the notification pipeline.
 *  - All handlers are fully error-isolated (never propagate to emitter).
 */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // ─────────────────────────────────────────────────────────────
  // AUTH EVENTS
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.USER_VERIFIED, { async: true })
  async handleUserVerified(payload: UserVerifiedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.ACCOUNT_VERIFIED,
      title: 'Account Verified ✅',
      body: 'Your email has been verified. Welcome to Eventy!',
      metadata: { email: payload.email },
    });
  }

  @OnEvent(DomainEvents.USER_BLOCKED, { async: true })
  async handleUserBlocked(payload: UserBlockedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.ACCOUNT_BLOCKED,
      title: 'Account Suspended',
      body: payload.reason
        ? `Your account has been suspended. Reason: ${payload.reason}`
        : 'Your account has been suspended. Please contact support.',
      metadata: { reason: payload.reason },
    });
  }

  @OnEvent(DomainEvents.USER_UNBLOCKED, { async: true })
  async handleUserUnblocked(payload: UserUnblockedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.ACCOUNT_UNBLOCKED,
      title: 'Account Reactivated ✅',
      body: 'Your account has been reactivated. You can now use Eventy again.',
    });
  }

  // ─────────────────────────────────────────────────────────────
  // BOOKING EVENTS
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.BOOKING_CREATED, { async: true })
  async handleBookingCreated(payload: BookingCreatedPayload): Promise<void> {
    // Notify the SERVICE PROVIDER that a booking request arrived
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.BOOKING_CREATED,
      title: 'New Booking Request 📋',
      body: `You have a new booking request for "${payload.serviceName}".`,
      metadata: {
        bookingId: payload.bookingId,
        serviceName: payload.serviceName,
        eventDate: payload.eventDate,
      },
    });
  }

  @OnEvent(DomainEvents.BOOKING_ACCEPTED, { async: true })
  async handleBookingAccepted(payload: BookingAcceptedPayload): Promise<void> {
    // Notify the CUSTOMER that their booking was accepted
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.BOOKING_ACCEPTED,
      title: 'Booking Accepted 🎉',
      body: `Your booking for "${payload.serviceName}" has been accepted!`,
      metadata: {
        bookingId: payload.bookingId,
        serviceName: payload.serviceName,
        eventDate: payload.eventDate,
      },
    });
  }

  @OnEvent(DomainEvents.BOOKING_REJECTED, { async: true })
  async handleBookingRejected(payload: BookingRejectedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.BOOKING_REJECTED,
      title: 'Booking Rejected',
      body: payload.rejectionReason
        ? `Your booking for "${payload.serviceName}" was rejected. Reason: ${payload.rejectionReason}`
        : `Your booking for "${payload.serviceName}" was rejected.`,
      metadata: {
        bookingId: payload.bookingId,
        rejectionReason: payload.rejectionReason,
      },
    });
  }

  @OnEvent(DomainEvents.BOOKING_COMPLETED, { async: true })
  async handleBookingCompleted(payload: BookingCompletedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.BOOKING_COMPLETED,
      title: 'Booking Completed ✅',
      body: `Your booking for "${payload.serviceName}" has been marked as completed.`,
      metadata: { bookingId: payload.bookingId },
    });
  }

  @OnEvent(DomainEvents.BOOKING_CANCELLED, { async: true })
  async handleBookingCancelled(payload: BookingCancelledPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Booking Cancelled',
      body: `Your booking for "${payload.serviceName}" has been cancelled.`,
      metadata: { bookingId: payload.bookingId },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PROVIDER EVENTS
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.PROVIDER_APPROVED, { async: true })
  async handleProviderApproved(payload: ProviderApprovedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PROVIDER_APPROVED,
      title: 'Provider Application Approved 🎉',
      body: payload.adminMessage
        ? `Your provider application for "${payload.businessName}" has been approved! Note: ${payload.adminMessage}`
        : `Your provider application for "${payload.businessName}" has been approved!`,
      metadata: { providerId: payload.providerId, adminMessage: payload.adminMessage },
    });
  }

  @OnEvent(DomainEvents.PROVIDER_REJECTED, { async: true })
  async handleProviderRejected(payload: ProviderRejectedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PROVIDER_REJECTED,
      title: 'Provider Application Rejected',
      body: payload.adminMessage
        ? `Your provider application for "${payload.businessName}" was rejected. Reason: ${payload.adminMessage}`
        : `Your provider application for "${payload.businessName}" was rejected.`,
      metadata: { providerId: payload.providerId, adminMessage: payload.adminMessage },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // SERVICE EVENTS
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.SERVICE_APPROVED, { async: true })
  async handleServiceApproved(payload: ServiceApprovedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.SERVICE_APPROVED,
      title: 'Service Approved ✅',
      body: payload.adminMessage
        ? `Your service "${payload.serviceName}" has been approved and is now live! Note: ${payload.adminMessage}`
        : `Your service "${payload.serviceName}" has been approved and is now live!`,
      metadata: { serviceId: payload.serviceId, adminMessage: payload.adminMessage },
    });
  }

  @OnEvent(DomainEvents.SERVICE_REJECTED, { async: true })
  async handleServiceRejected(payload: ServiceRejectedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.SERVICE_REJECTED,
      title: 'Service Rejected',
      body: payload.adminMessage
        ? `Your service "${payload.serviceName}" was rejected. Reason: ${payload.adminMessage}`
        : `Your service "${payload.serviceName}" was rejected. Please review and resubmit.`,
      metadata: { serviceId: payload.serviceId, adminMessage: payload.adminMessage },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PAYMENT EVENTS
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.PAYMENT_CONFIRMED, { async: true })
  async handlePaymentConfirmed(payload: PaymentConfirmedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PAYMENT_CONFIRMED,
      title: 'Payment Confirmed 💳',
      body: `Payment of ${payload.amount} has been confirmed for your booking.`,
      metadata: { bookingId: payload.bookingId, amount: payload.amount },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // INTERNAL HELPER
  // ─────────────────────────────────────────────────────────────

  private async deliver(options: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.notificationsService.createAndDeliver(options);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[NotificationsListener] Unhandled error delivering ${options.type} to ${options.userId}: ${msg}`,
      );
    }
  }
}
