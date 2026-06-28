// src/modules/notifications/notifications.listener.ts

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import {
  BookingAcceptedPayload,
  BookingCancelledPayload,
  BookingCompletedPayload,
  BookingCreatedPayload,
  BookingQuoteSentPayload,
  BookingRejectedPayload,
  DomainEvents,
  PaymentConfirmedPayload,
  ProviderApprovedPayload,
  ProviderRejectedPayload,
  ProviderRegisteredPayload,
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
      metadata: {
        screen: 'profile',
        targetUserId: payload.targetUserId,
        email: payload.email,
      },
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
      metadata: {
        screen: 'security',
        targetUserId: payload.targetUserId,
        reason: payload.reason,
      },
    });
  }

  @OnEvent(DomainEvents.USER_UNBLOCKED, { async: true })
  async handleUserUnblocked(payload: UserUnblockedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.ACCOUNT_UNBLOCKED,
      title: 'Account Reactivated ✅',
      body: 'Your account has been reactivated. You can now use Eventy again.',
      metadata: {
        screen: 'profile',
        targetUserId: payload.targetUserId,
      },
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
        screen: 'booking-details',
        bookingId: payload.bookingId,
        providerUserId: payload.targetUserId,
        customerUserId: payload.actorId,
        serviceType: payload.serviceName,
        eventDate: payload.eventDate.toISOString(),
      },
    });
  }

  @OnEvent(DomainEvents.BOOKING_QUOTE_SENT, { async: true })
  async handleBookingQuoteSent(payload: BookingQuoteSentPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.BOOKING_QUOTE_SENT,
      title: 'Quote Ready for Review 💰',
      body: `A new price quote is ready for your "${payload.serviceName}" booking. Please review and confirm.`,
      metadata: {
        screen: 'booking-quote',
        bookingId: payload.bookingId,
        customerUserId: payload.targetUserId,
        providerUserId: payload.actorId,
        serviceType: payload.serviceName,
        eventDate: payload.eventDate.toISOString(),
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
        screen: 'booking-details',
        bookingId: payload.bookingId,
        providerUserId: payload.targetUserId,
        customerUserId: payload.actorId,
        serviceType: payload.serviceName,
        eventDate: payload.eventDate.toISOString(),
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
        screen: 'booking-details',
        bookingId: payload.bookingId,
        providerUserId: payload.targetUserId,
        customerUserId: payload.actorId,
        serviceType: payload.serviceName,
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
      metadata: {
        screen: 'booking-details',
        bookingId: payload.bookingId,
        targetUserId: payload.targetUserId,
        serviceType: payload.serviceName,
      },
    });
  }

  @OnEvent(DomainEvents.BOOKING_CANCELLED, { async: true })
  async handleBookingCancelled(payload: BookingCancelledPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Booking Cancelled',
      body: `Your booking for "${payload.serviceName}" has been cancelled.`,
      metadata: {
        screen: 'booking-details',
        bookingId: payload.bookingId,
        targetUserId: payload.targetUserId,
        serviceType: payload.serviceName,
      },
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
      metadata: {
        screen: 'provider-profile',
        providerId: payload.providerId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        businessName: payload.businessName,
        approvalStatus: 'APPROVED',
        adminMessage: payload.adminMessage,
      },
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
      metadata: {
        screen: 'provider-profile',
        providerId: payload.providerId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        businessName: payload.businessName,
        approvalStatus: 'REJECTED',
        rejectionReason: payload.adminMessage,
        adminMessage: payload.adminMessage,
      },
    });
  }

  @OnEvent(DomainEvents.PROVIDER_REGISTERED, { async: true })
  async handleProviderRegistered(payload: ProviderRegisteredPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PROVIDER_REGISTERED,
      title: 'Provider Application Registered',
      body: payload.adminMessage
        ? `Your provider application for "${payload.businessName}" was registered. Reason: ${payload.adminMessage}`
        : `Your provider application for "${payload.businessName}" was registered.`,
      metadata: {
        screen: 'provider-review',
        providerId: payload.providerId,
        targetUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        businessName: payload.businessName,
        adminMessage: payload.adminMessage,
      },
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
      metadata: {
        screen: 'service-details',
        serviceId: payload.serviceId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        serviceType: payload.serviceName,
        approvalStatus: 'APPROVED',
        adminMessage: payload.adminMessage,
      },
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
      metadata: {
        screen: 'service-details',
        serviceId: payload.serviceId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        serviceType: payload.serviceName,
        approvalStatus: 'REJECTED',
        rejectionReason: payload.adminMessage,
        adminMessage: payload.adminMessage,
      },
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
      metadata: {
        screen: 'booking-payment',
        bookingId: payload.bookingId,
        customerUserId: payload.targetUserId,
        amount: payload.amount,
      },
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
