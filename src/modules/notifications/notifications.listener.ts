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
  EventCancelledPayload,
  PaymentConfirmedPayload,
  PaymentFailedPayload,
  ProviderApprovedPayload,
  ProviderRejectedPayload,
  ProviderRegisteredPayload,
  ServiceApprovedPayload,
  ServiceRejectedPayload,
  PackageJoinRequestedPayload,
  PackageActivatedPayload,
  PackageJoinAcceptedPayload,
  PackageJoinRejectedPayload,
  PackagePartnerLeftPayload,
  PackageBookingRequestedPayload,
  PackageBookingAcceptedPayload,
  PackageBookingRejectedPayload,
  PackagePaymentCashChosenPayload,
  PackagePaymentConfirmedPayload,
  PackageBookingPaymentExpiredPayload,
  DiscountCancelledPayload,
  ReviewRepliedPayload,
  ComplaintStatusChangedPayload,
  ComplaintRepliedPayload,
  DeliveryStatusChangedPayload,
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
    const body = payload.paymentMethodLabel
      ? `Your quotation for "${payload.serviceName}" has been accepted. Payment method: ${payload.paymentMethodLabel}.`
      : `Your booking for "${payload.serviceName}" has been accepted!`;

    await this.deliver({
      userId: payload.targetUserId,
      type: payload.paymentMethodLabel
        ? NotificationType.BOOKING_QUOTE_CONFIRMED
        : NotificationType.BOOKING_ACCEPTED,
      title: payload.paymentMethodLabel ? 'Quotation Accepted 🎉' : 'Booking Accepted 🎉',
      body,
      metadata: {
        screen: 'booking-details',
        bookingId: payload.bookingId,
        providerUserId: payload.targetUserId,
        customerUserId: payload.actorId,
        serviceType: payload.serviceName,
        eventDate: payload.eventDate.toISOString(),
        paymentMethodLabel: payload.paymentMethodLabel,
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
      body: `Your booking for "${payload.serviceName}" is complete — let others know how it went!`,
      metadata: {
        // deep-links to the review prompt (docs/reviews-implementation-plan.md §3)
        screen: 'leave-review',
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
      body: payload.reason
        ? `Your booking for "${payload.serviceName}" has been cancelled. ${payload.reason}`
        : `Your booking for "${payload.serviceName}" has been cancelled.`,
      metadata: {
        screen: 'booking-details',
        bookingId: payload.bookingId,
        targetUserId: payload.targetUserId,
        serviceType: payload.serviceName,
        reason: payload.reason,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // EVENT EVENTS
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.EVENT_CANCELLED, { async: true })
  async handleEventCancelled(payload: EventCancelledPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.EVENT_CANCELLED,
      title: 'Event Cancelled',
      body: `Your event "${payload.eventName}" has been cancelled because ${payload.reason}.`,
      metadata: {
        screen: 'event-details',
        eventId: payload.eventId,
        customerUserId: payload.targetUserId,
        reason: payload.reason,
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
  // PACKAGE EVENTS (docs/implementation_plan.md §4)
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.PACKAGE_JOIN_REQUESTED, { async: true })
  async handlePackageJoinRequested(payload: PackageJoinRequestedPayload): Promise<void> {
    const servicePart = payload.serviceName ? ` for "${payload.serviceName}"` : '';
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_JOIN_REQUESTED,
      title: 'Package Join Request 📦',
      body: `${payload.ownerProviderName} invited your service${servicePart} to join "${payload.packageName}".`,
      metadata: {
        screen: 'package-join-request',
        packageId: payload.packageId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        ownerProviderName: payload.ownerProviderName,
        serviceName: payload.serviceName,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_ACTIVATED, { async: true })
  async handlePackageActivated(payload: PackageActivatedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_ACTIVATED,
      title: 'Package Activated ✅',
      body: `"${payload.packageName}" by ${payload.ownerProviderName} is now active.`,
      metadata: {
        screen: 'package-details',
        packageId: payload.packageId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        ownerProviderName: payload.ownerProviderName,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_JOIN_ACCEPTED, { async: true })
  async handlePackageJoinAccepted(payload: PackageJoinAcceptedPayload): Promise<void> {
    const servicePart = payload.serviceName ? ` (${payload.serviceName})` : '';
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_JOIN_ACCEPTED,
      title: 'Join Request Accepted ✅',
      body: `${payload.partnerProviderName}${servicePart} accepted your invitation to join "${payload.packageName}".`,
      metadata: {
        screen: 'package-details',
        packageId: payload.packageId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        partnerProviderName: payload.partnerProviderName,
        serviceName: payload.serviceName,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_JOIN_REJECTED, { async: true })
  async handlePackageJoinRejected(payload: PackageJoinRejectedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_JOIN_REJECTED,
      title: 'Join Request Rejected',
      body: payload.rejectionReason
        ? `${payload.partnerProviderName} rejected your invitation to join "${payload.packageName}". Reason: ${payload.rejectionReason}`
        : `${payload.partnerProviderName} rejected your invitation to join "${payload.packageName}".`,
      metadata: {
        screen: 'package-details',
        packageId: payload.packageId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        partnerProviderName: payload.partnerProviderName,
        rejectionReason: payload.rejectionReason,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_PARTNER_LEFT, { async: true })
  async handlePackagePartnerLeft(payload: PackagePartnerLeftPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_PARTNER_LEFT,
      title: 'Partner Left Package',
      body: `${payload.partnerProviderName} left your package "${payload.packageName}".`,
      metadata: {
        screen: 'package-details',
        packageId: payload.packageId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        partnerProviderName: payload.partnerProviderName,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_BOOKING_REQUESTED, { async: true })
  async handlePackageBookingRequested(payload: PackageBookingRequestedPayload): Promise<void> {
    const customerPart = payload.customerName ? `${payload.customerName} requested` : 'A customer requested';
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_BOOKING_REQUESTED,
      title: 'New Package Booking Request 📋',
      body: `${customerPart} to book "${payload.packageName}".`,
      metadata: {
        screen: 'package-booking-details',
        packageId: payload.packageId,
        packageEventBookingId: payload.packageEventBookingId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        customerName: payload.customerName,
        eventDate: payload.eventDate?.toISOString(),
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_BOOKING_ACCEPTED, { async: true })
  async handlePackageBookingAccepted(payload: PackageBookingAcceptedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_BOOKING_ACCEPTED,
      title: 'Package Booking Accepted 🎉',
      body: `Your booking for "${payload.packageName}" has been accepted.`,
      metadata: {
        screen: 'package-booking-details',
        packageId: payload.packageId,
        packageEventBookingId: payload.packageEventBookingId,
        customerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_BOOKING_REJECTED, { async: true })
  async handlePackageBookingRejected(payload: PackageBookingRejectedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_BOOKING_REJECTED,
      title: 'Package Booking Rejected',
      body: payload.rejectionReason
        ? `Your booking for "${payload.packageName}" was rejected. Reason: ${payload.rejectionReason}`
        : `Your booking for "${payload.packageName}" was rejected.`,
      metadata: {
        screen: 'package-booking-details',
        packageId: payload.packageId,
        packageEventBookingId: payload.packageEventBookingId,
        customerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        rejectionReason: payload.rejectionReason,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_PAYMENT_CASH_CHOSEN, { async: true })
  async handlePackagePaymentCashChosen(payload: PackagePaymentCashChosenPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_PAYMENT_CASH_CHOSEN,
      title: 'Cash Payment Selected 💵',
      body: payload.amount != null
        ? `The customer chose cash payment (${payload.amount}) for "${payload.packageName}".`
        : `The customer chose cash payment for "${payload.packageName}".`,
      metadata: {
        screen: 'package-booking-payment',
        packageId: payload.packageId,
        packageEventBookingId: payload.packageEventBookingId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        amount: payload.amount,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_PAYMENT_CONFIRMED, { async: true })
  async handlePackagePaymentConfirmed(payload: PackagePaymentConfirmedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_PAYMENT_CONFIRMED,
      title: 'Package Payment Confirmed 💳',
      body: payload.amount != null
        ? `Payment of ${payload.amount} for "${payload.packageName}" has been confirmed.`
        : `Payment for "${payload.packageName}" has been confirmed.`,
      metadata: {
        screen: 'package-booking-payment',
        packageId: payload.packageId,
        packageEventBookingId: payload.packageEventBookingId,
        providerUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
        amount: payload.amount,
      },
    });
  }

  @OnEvent(DomainEvents.PACKAGE_BOOKING_PAYMENT_EXPIRED, { async: true })
  async handlePackageBookingPaymentExpired(payload: PackageBookingPaymentExpiredPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PACKAGE_BOOKING_PAYMENT_EXPIRED,
      title: 'Payment Window Expired',
      body: `The payment window for "${payload.packageName}" has expired and the booking was cancelled.`,
      metadata: {
        screen: 'package-booking-details',
        packageId: payload.packageId,
        packageEventBookingId: payload.packageEventBookingId,
        targetUserId: payload.targetUserId,
        actorUserId: payload.actorId,
        packageName: payload.packageName,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // DISCOUNT EVENTS (docs/discounts-implementation-plan.md §7)
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.DISCOUNT_CANCELLED, { async: true })
  async handleDiscountCancelled(payload: DiscountCancelledPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.DISCOUNT_CANCELLED,
      title: 'Discount Cancelled',
      body: 'A discount on one of your listings has been cancelled.',
      metadata: {
        screen: 'discounts',
        discountId: payload.discountId,
        actorUserId: payload.actorId,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // REVIEW EVENTS (docs/reviews-implementation-plan.md §6)
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.REVIEW_REPLIED, { async: true })
  async handleReviewReplied(payload: ReviewRepliedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.REVIEW_REPLIED,
      title: 'The Provider Replied to Your Review',
      body: 'The provider has replied to the review you left.',
      metadata: {
        screen: 'service-reviews',
        reviewId: payload.reviewId,
        serviceId: payload.serviceId,
        actorUserId: payload.actorId,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // COMPLAINT EVENTS (docs/complaints-implementation-plan.md §6)
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.COMPLAINT_STATUS_CHANGED, { async: true })
  async handleComplaintStatusChanged(payload: ComplaintStatusChangedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.COMPLAINT_STATUS_CHANGED,
      title: 'Complaint Status Updated',
      body: `Your complaint is now ${payload.status}.`,
      metadata: {
        screen: 'complaint-details',
        complaintId: payload.complaintId,
        status: payload.status,
        actorUserId: payload.actorId,
      },
    });
  }

  @OnEvent(DomainEvents.COMPLAINT_REPLIED, { async: true })
  async handleComplaintReplied(payload: ComplaintRepliedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.COMPLAINT_REPLIED,
      title: 'Admin Replied to Your Complaint',
      body: 'The administration has replied to your complaint.',
      metadata: {
        screen: 'complaint-details',
        complaintId: payload.complaintId,
        actorUserId: payload.actorId,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // DELIVERY EVENTS (docs/delivery-implementation-plan.md §6)
  // ─────────────────────────────────────────────────────────────

  @OnEvent(DomainEvents.DELIVERY_OUT_FOR_DELIVERY, { async: true })
  async handleDeliveryOutForDelivery(payload: DeliveryStatusChangedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.DELIVERY_OUT_FOR_DELIVERY,
      title: 'Out for Delivery',
      body: 'Your order is now out for delivery.',
      metadata: { screen: 'booking-delivery', deliveryId: payload.deliveryId, bookingId: payload.bookingId },
    });
  }

  @OnEvent(DomainEvents.DELIVERY_COMPLETED, { async: true })
  async handleDeliveryCompleted(payload: DeliveryStatusChangedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.DELIVERY_COMPLETED,
      title: 'Delivered ✅',
      body: 'Your order has been delivered.',
      metadata: { screen: 'booking-delivery', deliveryId: payload.deliveryId, bookingId: payload.bookingId },
    });
  }

  @OnEvent(DomainEvents.DELIVERY_FAILED, { async: true })
  async handleDeliveryFailed(payload: DeliveryStatusChangedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.DELIVERY_FAILED,
      title: 'Delivery Failed',
      body: 'Delivery could not be completed. Please contact the provider.',
      metadata: { screen: 'booking-delivery', deliveryId: payload.deliveryId, bookingId: payload.bookingId },
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

  @OnEvent(DomainEvents.PAYMENT_FAILED, { async: true })
  async handlePaymentFailed(payload: PaymentFailedPayload): Promise<void> {
    await this.deliver({
      userId: payload.targetUserId,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Payment Failed',
      body: payload.failureReason
        ? `Payment of ${payload.amount} failed: ${payload.failureReason}`
        : `Payment of ${payload.amount} failed. Please try again.`,
      metadata: {
        screen: 'booking-payment',
        bookingId: payload.bookingId,
        customerUserId: payload.targetUserId,
        amount: payload.amount,
        failureReason: payload.failureReason,
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
