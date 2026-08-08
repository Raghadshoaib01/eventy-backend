// src/modules/packages/packages.constants.ts

/**
 * Package join-request expiry window (implementation_plan.md §5.1).
 * The cron job in `packages-cron.service.ts` uses this to flip stale
 * PENDING_PROVIDER_APPROVAL rows to REJECTED. Kept for forward
 * compatibility — current single-provider-only mode doesn't emit join
 * requests, but the constant is referenced by the cron anyway.
 */
export const PACKAGE_JOIN_TIMEOUT_HOURS = 24;

/**
 * Window after which a still-PENDING PackageEventBooking is auto-expired
 * (implementation_plan.md §5.2). The cron flips PENDING → EXPIRED and
 * cancels the child bookings.
 */
export const PACKAGE_BOOKING_REQUEST_TIMEOUT_HOURS = 48;

/**
 * Window after which an unpaid CONFIRMED/PENDING_PAYMENT PackageEventBooking
 * is auto-cancelled (implementation_plan.md §5.3).
 */
export const PACKAGE_PAYMENT_TIMEOUT_HOURS = 24;
