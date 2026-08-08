// src/common/events/domain-event-bus.ts

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvents,
  UserVerifiedPayload,
  UserBlockedPayload,
  UserUnblockedPayload,
  BookingCreatedPayload,
  BookingAcceptedPayload,
  BookingRejectedPayload,
  BookingCompletedPayload,
  BookingCancelledPayload,
  ProviderApprovedPayload,
  ProviderRejectedPayload,
  ProviderRegisteredPayload,
  ServiceApprovedPayload,
  ServiceRejectedPayload,
  PaymentConfirmedPayload,
  PaymentFailedPayload,
  BookingQuoteSentPayload,
  EventCancelledPayload,
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
} from './domain-events';

/**
 * DomainEventBus
 *
 * Thin wrapper over EventEmitter2.
 * Provides typed, discoverable methods for emitting domain events.
 * Eliminates raw string event names from service code.
 * Single place to find all domain events in the system.
 */
@Injectable()
export class DomainEventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  // ── Auth ──────────────────────────────────────────────────

  userVerified(payload: UserVerifiedPayload): void {
    this.emitter.emit(DomainEvents.USER_VERIFIED, payload);
  }

  userBlocked(payload: UserBlockedPayload): void {
    this.emitter.emit(DomainEvents.USER_BLOCKED, payload);
  }

  userUnblocked(payload: UserUnblockedPayload): void {
    this.emitter.emit(DomainEvents.USER_UNBLOCKED, payload);
  }

  // ── Booking ───────────────────────────────────────────────

  bookingCreated(payload: BookingCreatedPayload): void {
    this.emitter.emit(DomainEvents.BOOKING_CREATED, payload);
  }

  bookingQuoteSent(payload: BookingQuoteSentPayload): void {
    this.emitter.emit(DomainEvents.BOOKING_QUOTE_SENT, payload);
  }

  bookingAccepted(payload: BookingAcceptedPayload): void {
    this.emitter.emit(DomainEvents.BOOKING_ACCEPTED, payload);
  }

  bookingRejected(payload: BookingRejectedPayload): void {
    this.emitter.emit(DomainEvents.BOOKING_REJECTED, payload);
  }

  bookingCompleted(payload: BookingCompletedPayload): void {
    this.emitter.emit(DomainEvents.BOOKING_COMPLETED, payload);
  }

  bookingCancelled(payload: BookingCancelledPayload): void {
    this.emitter.emit(DomainEvents.BOOKING_CANCELLED, payload);
  }

  // ── Event ─────────────────────────────────────────────────

  eventCancelled(payload: EventCancelledPayload): void {
    this.emitter.emit(DomainEvents.EVENT_CANCELLED, payload);
  }

  // ── Provider ──────────────────────────────────────────────

  providerApproved(payload: ProviderApprovedPayload): void {
    this.emitter.emit(DomainEvents.PROVIDER_APPROVED, payload);
  }

  providerRejected(payload: ProviderRejectedPayload): void {
    this.emitter.emit(DomainEvents.PROVIDER_REJECTED, payload);
  }

  providerRegistered(payload: ProviderRegisteredPayload): void {
    this.emitter.emit(DomainEvents.PROVIDER_REGISTERED, payload);
  }

  // ── Service ───────────────────────────────────────────────

  serviceApproved(payload: ServiceApprovedPayload): void {
    this.emitter.emit(DomainEvents.SERVICE_APPROVED, payload);
  }

  serviceRejected(payload: ServiceRejectedPayload): void {
    this.emitter.emit(DomainEvents.SERVICE_REJECTED, payload);
  }

  // ── Payment ───────────────────────────────────────────────

  paymentConfirmed(payload: PaymentConfirmedPayload): void {
    this.emitter.emit(DomainEvents.PAYMENT_CONFIRMED, payload);
  }

  paymentFailed(payload: PaymentFailedPayload): void {
    this.emitter.emit(DomainEvents.PAYMENT_FAILED, payload);
  }

  // ── Package (docs/implementation_plan.md §4) ──────────────

  packageJoinRequested(payload: PackageJoinRequestedPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_JOIN_REQUESTED, payload);
  }

  packageActivated(payload: PackageActivatedPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_ACTIVATED, payload);
  }

  packageJoinAccepted(payload: PackageJoinAcceptedPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_JOIN_ACCEPTED, payload);
  }

  packageJoinRejected(payload: PackageJoinRejectedPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_JOIN_REJECTED, payload);
  }

  packagePartnerLeft(payload: PackagePartnerLeftPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_PARTNER_LEFT, payload);
  }

  packageBookingRequested(payload: PackageBookingRequestedPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_BOOKING_REQUESTED, payload);
  }

  packageBookingAccepted(payload: PackageBookingAcceptedPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_BOOKING_ACCEPTED, payload);
  }

  packageBookingRejected(payload: PackageBookingRejectedPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_BOOKING_REJECTED, payload);
  }

  packagePaymentCashChosen(payload: PackagePaymentCashChosenPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_PAYMENT_CASH_CHOSEN, payload);
  }

  packagePaymentConfirmed(payload: PackagePaymentConfirmedPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_PAYMENT_CONFIRMED, payload);
  }

  packageBookingPaymentExpired(payload: PackageBookingPaymentExpiredPayload): void {
    this.emitter.emit(DomainEvents.PACKAGE_BOOKING_PAYMENT_EXPIRED, payload);
  }

  // ── Discount ──────────────────────────────────────────────

  discountCancelled(payload: DiscountCancelledPayload): void {
    this.emitter.emit(DomainEvents.DISCOUNT_CANCELLED, payload);
  }

  // ── Review ────────────────────────────────────────────────

  reviewReplied(payload: ReviewRepliedPayload): void {
    this.emitter.emit(DomainEvents.REVIEW_REPLIED, payload);
  }

  // ── Complaint ─────────────────────────────────────────────

  complaintStatusChanged(payload: ComplaintStatusChangedPayload): void {
    this.emitter.emit(DomainEvents.COMPLAINT_STATUS_CHANGED, payload);
  }

  complaintReplied(payload: ComplaintRepliedPayload): void {
    this.emitter.emit(DomainEvents.COMPLAINT_REPLIED, payload);
  }

  // ── Delivery ──────────────────────────────────────────────

  deliveryOutForDelivery(payload: DeliveryStatusChangedPayload): void {
    this.emitter.emit(DomainEvents.DELIVERY_OUT_FOR_DELIVERY, payload);
  }

  deliveryCompleted(payload: DeliveryStatusChangedPayload): void {
    this.emitter.emit(DomainEvents.DELIVERY_COMPLETED, payload);
  }

  deliveryFailed(payload: DeliveryStatusChangedPayload): void {
    this.emitter.emit(DomainEvents.DELIVERY_FAILED, payload);
  }
}