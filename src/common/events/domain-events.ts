// src/common/events/domain-events.ts

// ─────────────────────────────────────────────────────────────
// EVENT NAME CONSTANTS
// ─────────────────────────────────────────────────────────────

export const DomainEvents = {
  // Auth
  USER_VERIFIED: 'user.verified',
  USER_BLOCKED: 'user.blocked',
  USER_UNBLOCKED: 'user.unblocked',

  // Booking
  BOOKING_CREATED: 'booking.created',
  BOOKING_QUOTE_SENT: 'booking.quote.sent',
  BOOKING_ACCEPTED: 'booking.accepted',
  BOOKING_REJECTED: 'booking.rejected',
  BOOKING_COMPLETED: 'booking.completed',
  BOOKING_CANCELLED: 'booking.cancelled',

  // Event
  EVENT_CANCELLED: 'event.cancelled',

  // Provider
  PROVIDER_APPROVED: 'provider.approved',
  PROVIDER_REJECTED: 'provider.rejected',
  PROVIDER_REGISTERED: 'provider.registered',

  // Service
  SERVICE_APPROVED: 'service.approved',
  SERVICE_REJECTED: 'service.rejected',

  // Sub_Service
  SUB_SERVICE_APPROVED: 'sub_service.approved',
  SUB_SERVICE_REJECTED: 'sub_service.rejected',

  // Payment
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_FAILED: 'payment.failed',

  // Package (docs/implementation_plan.md §4)
  PACKAGE_JOIN_REQUESTED: 'package.join.requested',
  PACKAGE_ACTIVATED: 'package.activated',
  PACKAGE_JOIN_ACCEPTED: 'package.join.accepted',
  PACKAGE_JOIN_REJECTED: 'package.join.rejected',
  PACKAGE_PARTNER_LEFT: 'package.partner.left',
  PACKAGE_BOOKING_REQUESTED: 'package.booking.requested',
  PACKAGE_BOOKING_ACCEPTED: 'package.booking.accepted',
  PACKAGE_BOOKING_REJECTED: 'package.booking.rejected',
  PACKAGE_PAYMENT_CASH_CHOSEN: 'package.payment.cash.chosen',
  PACKAGE_PAYMENT_CONFIRMED: 'package.payment.confirmed',

  PACKAGE_JOIN_EXPIRED: 'package.join.expired',
  PACKAGE_BOOKING_EXPIRED: 'package.booking.expired',
  PACKAGE_PAYMENT_EXPIRED: 'package.payment.expired',
  PACKAGE_CANCELLED: 'package.cancelled',

  // Discount
  DISCOUNT_CANCELLED: 'discount.cancelled',

  // Review
  REVIEW_REPLIED: 'review.replied',

  // Complaint
  COMPLAINT_STATUS_CHANGED: 'complaint.status.changed',
  COMPLAINT_REPLIED: 'complaint.replied',

  // Delivery
  DELIVERY_OUT_FOR_DELIVERY: 'delivery.out_for_delivery',
  DELIVERY_COMPLETED: 'delivery.completed',
  DELIVERY_FAILED: 'delivery.failed',
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

// ─────────────────────────────────────────────────────────────
// SHARED BASE PAYLOAD
// ─────────────────────────────────────────────────────────────

export interface BaseDomainEventPayload {
  /** ID of the user who performed the action (admin, provider, customer) */
  actorId: string;
  /** ID of the user who should RECEIVE the notification */
  targetUserId: string;
  /** The primary entity ID (bookingId, serviceId, providerId …) */
  entityId: string;
  /** Optional extra data for notification body interpolation */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// PER-EVENT PAYLOAD TYPES
// ─────────────────────────────────────────────────────────────

export interface UserVerifiedPayload extends BaseDomainEventPayload {
  email: string;
}

export interface UserBlockedPayload extends BaseDomainEventPayload {
  reason?: string;
}

export interface UserUnblockedPayload extends BaseDomainEventPayload {}

export interface BookingCreatedPayload extends BaseDomainEventPayload {
  bookingId: string;
  serviceName: string;
  eventDate: Date;
}

export interface BookingAcceptedPayload extends BaseDomainEventPayload {
  bookingId: string;
  serviceName: string;
  eventDate: Date;
  /** Human-readable payment method label for provider notifications */
  paymentMethodLabel?: string;
}

export interface BookingRejectedPayload extends BaseDomainEventPayload {
  bookingId: string;
  serviceName: string;
  rejectionReason?: string;
}

export interface BookingCompletedPayload extends BaseDomainEventPayload {
  bookingId: string;
  serviceName: string;
}

export interface BookingCancelledPayload extends BaseDomainEventPayload {
  bookingId: string;
  serviceName: string;
   reason?: string;
}

export interface ProviderApprovedPayload extends BaseDomainEventPayload {
  providerId: string;
  businessName: string;
  adminMessage?: string;
}

export interface ProviderRejectedPayload extends BaseDomainEventPayload {
  providerId: string;
  businessName: string;
  adminMessage?: string;
}

export interface ProviderRegisteredPayload extends BaseDomainEventPayload {
  providerId: string;
  businessName: string;
  adminMessage?: string;
}

export interface ServiceApprovedPayload extends BaseDomainEventPayload {
  serviceId: string;
  serviceName: string;
  adminMessage?: string;
}

export interface ServiceRejectedPayload extends BaseDomainEventPayload {
  serviceId: string;
  serviceName: string;
  adminMessage?: string;
}

export interface PaymentConfirmedPayload extends BaseDomainEventPayload {
  bookingId: string;
  amount: number;
}

export interface PaymentFailedPayload extends BaseDomainEventPayload {
  bookingId: string;
  amount: number;
  failureReason?: string;
}

export interface BookingQuoteSentPayload extends BaseDomainEventPayload {
  bookingId: string;
  serviceName: string;
  eventDate: Date;
}

export interface EventCancelledPayload extends BaseDomainEventPayload {
  eventId: string;
  eventName: string;
  reason: string;
}

export interface PackageJoinRequestedPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  ownerProviderName: string;
  serviceName?: string;
}

export interface PackageActivatedPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  ownerProviderName: string;
}

export interface PackageJoinAcceptedPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  partnerProviderName: string;
  serviceName?: string;
}

export interface PackageJoinRejectedPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  partnerProviderName: string;
  rejectionReason?: string;
}

export interface PackagePartnerLeftPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  partnerProviderName: string;
}

export interface PackageBookingRequestedPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  packageEventBookingId: string;
  customerName?: string;
  eventDate?: Date;
}

export interface PackageBookingAcceptedPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  packageEventBookingId: string;
}

export interface PackageBookingRejectedPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  packageEventBookingId: string;
  rejectionReason?: string;
}

export interface PackagePaymentCashChosenPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  packageEventBookingId: string;
  amount?: number;
}

export interface PackagePaymentConfirmedPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  packageEventBookingId: string;
  amount?: number;
}

export interface PackageJoinExpiredPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
}

export interface PackageBookingExpiredPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  packageEventBookingId: string;
}

export interface PackagePaymentExpiredPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
  packageEventBookingId: string;
}

export interface PackageCancelledPayload extends BaseDomainEventPayload {
  packageId: string;
  packageName: string;
}

export interface DiscountCancelledPayload extends BaseDomainEventPayload {
  discountId: string;
}

export interface ReviewRepliedPayload extends BaseDomainEventPayload {
  reviewId: string;
  serviceId: string;
}

export interface ComplaintStatusChangedPayload extends BaseDomainEventPayload {
  complaintId: string;
  status: string;
}

export interface ComplaintRepliedPayload extends BaseDomainEventPayload {
  complaintId: string;
}

export interface DeliveryStatusChangedPayload extends BaseDomainEventPayload {
  deliveryId: string;
  bookingId: string;
}
