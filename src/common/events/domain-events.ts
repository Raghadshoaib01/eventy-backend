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
  BOOKING_ACCEPTED: 'booking.accepted',
  BOOKING_REJECTED: 'booking.rejected',
  BOOKING_COMPLETED: 'booking.completed',
  BOOKING_CANCELLED: 'booking.cancelled',

  // Provider
  PROVIDER_APPROVED: 'provider.approved',
  PROVIDER_REJECTED: 'provider.rejected',

  // Service
  SERVICE_APPROVED: 'service.approved',
  SERVICE_REJECTED: 'service.rejected',

  // Payment
  PAYMENT_CONFIRMED: 'payment.confirmed',
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
