# Notification Metadata Guidelines

This document describes the metadata structure attached to every notification created by the Eventy backend. Metadata supports frontend deep linking and immediate UI display without extra API calls.

## Design Principles

Every notification metadata object follows three categories:

1. **Navigation metadata (required)** — Stable UUIDs the frontend uses to route to the correct screen. Never use names or emails for navigation when a UUID exists.
2. **Display metadata (when available)** — Human-readable fields for inbox previews and detail headers, sourced from existing domain event payloads or seeded Prisma relations.
3. **Navigation hint** — A `screen` string that tells the frontend which route/component to open.

Runtime metadata is built exclusively from fields already present on domain event payloads. No additional database lookups are performed in the notification listener.

Seed metadata is built from IDs captured during the seed flow (`events.seed.ts`, `providers.seed.ts`) and loaded by primary key — never by event name, service type name, or email matching (except the initial notification recipient lookup).

---

## User Identifier Naming Convention

All user-related identifiers in notification metadata follow a unified naming convention:

| Field | Purpose |
|-------|---------|
| `customerUserId` | User UUID of the customer involved |
| `providerUserId` | User UUID of the provider involved |
| `actorUserId` | User UUID of the user who performed the action (e.g. admin approval) |
| `targetUserId` | Recipient user UUID — used only when the role is unknown or ambiguous (auth self-notifications, admin recipients, unimplemented emitters) |

**Do not use** inconsistent names such as `userId` or `customerId` when referring to a user UUID. Entity IDs like `providerId` (ServiceProvider record) and `serviceId` remain unchanged.

This ensures consistent frontend routing across all notification types.

---

## Service Display Fields

| Field | When to include |
|-------|-----------------|
| `serviceType` | Always — the service category (e.g. `HALL`, `FOOD`) |
| `serviceName` | Only when a distinct display name exists and differs from `serviceType` (e.g. service `description` in seed data) |

Never set `serviceName` to the same value as `serviceType`. Runtime payloads carry the type name in `payload.serviceName`; metadata maps this to `serviceType` only.

---

## Implemented Notification Types

### Auth

#### `ACCOUNT_VERIFIED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"profile"` |
| `targetUserId` | Navigation | Verified user UUID (role-agnostic) |
| `email` | Display | Verified email address |

**Deep link:** Profile screen for `targetUserId`.

Seed variant uses `customerUserId` when the recipient is a known customer.

---

#### `ACCOUNT_BLOCKED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"security"` |
| `targetUserId` | Navigation | Suspended user UUID |
| `reason` | Display | Suspension reason (when provided) |

**Deep link:** Security / account status screen for `targetUserId`.

> **Note:** Event emitter not yet wired in services; listener metadata is ready when `USER_BLOCKED` is emitted.

---

#### `ACCOUNT_UNBLOCKED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"profile"` |
| `targetUserId` | Navigation | Reactivated user UUID |

**Deep link:** Profile screen for `targetUserId`.

> **Note:** Event emitter not yet wired in services; listener metadata is ready when `USER_UNBLOCKED` is emitted.

---

### Booking

#### `BOOKING_CREATED`

Sent to the **provider** when a customer creates a booking.

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"booking-details"` |
| `bookingId` | Navigation | Booking UUID |
| `providerUserId` | Navigation | Provider user UUID (recipient) |
| `customerUserId` | Navigation | Customer user UUID (actor) |
| `serviceType` | Display | Service category |
| `eventDate` | Display | ISO 8601 event date |

**Deep link:** Provider booking details for `bookingId`.

---

#### `BOOKING_QUOTE_SENT`

Sent to the **customer** when a provider sends a quote.

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"booking-quote"` |
| `bookingId` | Navigation | Booking UUID |
| `customerUserId` | Navigation | Customer user UUID (recipient) |
| `providerUserId` | Navigation | Provider user UUID (actor) |
| `serviceType` | Display | Service category |
| `eventDate` | Display | ISO 8601 event date |

**Deep link:** Customer quote review for `bookingId`.

---

#### `BOOKING_ACCEPTED`

Sent to the **provider** when a customer confirms a quote.

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"booking-details"` |
| `bookingId` | Navigation | Booking UUID |
| `providerUserId` | Navigation | Provider user UUID (recipient) |
| `customerUserId` | Navigation | Customer user UUID (actor) |
| `serviceType` | Display | Service category |
| `eventDate` | Display | ISO 8601 event date |

**Deep link:** Provider booking details for `bookingId`.

---

#### `BOOKING_REJECTED`

Sent to the **provider** when a customer rejects a quote.

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"booking-details"` |
| `bookingId` | Navigation | Booking UUID |
| `providerUserId` | Navigation | Provider user UUID (recipient) |
| `customerUserId` | Navigation | Customer user UUID (actor) |
| `serviceType` | Display | Service category |
| `rejectionReason` | Display | Rejection reason (when provided) |

**Deep link:** Provider booking details for `bookingId`.

---

#### `BOOKING_COMPLETED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"booking-details"` |
| `bookingId` | Navigation | Booking UUID |
| `targetUserId` | Navigation | Recipient user UUID |
| `serviceType` | Display | Service category |

**Deep link:** Booking details for `bookingId`.

> **Note:** Event emitter not yet wired in services.

---

#### `BOOKING_CANCELLED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"booking-details"` |
| `bookingId` | Navigation | Booking UUID |
| `targetUserId` | Navigation | Recipient user UUID |
| `serviceType` | Display | Service category |

**Deep link:** Booking details for `bookingId`.

> **Note:** Event emitter not yet wired in services.

---

### Provider

#### `PROVIDER_APPROVED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"provider-profile"` |
| `providerId` | Navigation | ServiceProvider entity UUID |
| `providerUserId` | Navigation | Provider owner user UUID (recipient) |
| `actorUserId` | Navigation | Admin user UUID who approved |
| `businessName` | Display | Provider business name |
| `approvalStatus` | Display | `"APPROVED"` |
| `adminMessage` | Display | Optional admin note |

**Deep link:** Provider profile for `providerId`.

---

#### `PROVIDER_REJECTED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"provider-profile"` |
| `providerId` | Navigation | ServiceProvider entity UUID |
| `providerUserId` | Navigation | Provider owner user UUID (recipient) |
| `actorUserId` | Navigation | Admin user UUID who rejected |
| `businessName` | Display | Provider business name |
| `approvalStatus` | Display | `"REJECTED"` |
| `rejectionReason` | Display | Rejection reason (same as `adminMessage` when present) |
| `adminMessage` | Display | Optional admin note |

**Deep link:** Provider profile for `providerId`.

---

#### `PROVIDER_REGISTERED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"provider-review"` |
| `providerId` | Navigation | ServiceProvider entity UUID |
| `targetUserId` | Navigation | Recipient user UUID (typically admin) |
| `actorUserId` | Navigation | User UUID who registered |
| `businessName` | Display | Provider business name |
| `adminMessage` | Display | Optional admin note |

**Deep link:** Admin provider review for `providerId`.

> **Note:** Event emitter not yet wired in services.

---

### Service

#### `SERVICE_APPROVED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"service-details"` |
| `serviceId` | Navigation | Service UUID |
| `providerUserId` | Navigation | Provider owner user UUID (recipient) |
| `actorUserId` | Navigation | Admin user UUID who approved |
| `serviceType` | Display | Service category |
| `approvalStatus` | Display | `"APPROVED"` |
| `adminMessage` | Display | Optional admin note |

**Deep link:** Service details for `serviceId`.

---

#### `SERVICE_REJECTED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"service-details"` |
| `serviceId` | Navigation | Service UUID |
| `providerUserId` | Navigation | Provider owner user UUID (recipient) |
| `actorUserId` | Navigation | Admin user UUID who rejected |
| `serviceType` | Display | Service category |
| `approvalStatus` | Display | `"REJECTED"` |
| `rejectionReason` | Display | Rejection reason (same as `adminMessage` when present) |
| `adminMessage` | Display | Optional admin note |

**Deep link:** Service details for `serviceId`.

---

### Payment

#### `PAYMENT_CONFIRMED`

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"booking-payment"` |
| `bookingId` | Navigation | Booking UUID |
| `customerUserId` | Navigation | Customer user UUID (recipient) |
| `amount` | Display | Confirmed payment amount |

**Deep link:** Booking payment screen for `bookingId`.

> **Note:** Event emitter not yet wired in services.

---

### Seed-only

#### `ADMIN_NEW_PROVIDER_REQUEST`

Seeded for admin inbox testing; no runtime listener exists.

| Field | Category | Purpose |
|-------|----------|---------|
| `screen` | Navigation hint | `"provider-review"` |
| `providerId` | Navigation | ServiceProvider entity UUID |
| `providerUserId` | Navigation | Provider owner user UUID |
| `businessName` | Display | Provider business name |
| `approvalStatus` | Display | `"PENDING"` |

**Deep link:** Admin provider review for `providerId`.

---

## Seed Notification Metadata

Seed notifications receive a `SeedNotificationContext` containing booking IDs from `events.seed.ts` and provider/service refs from `providers.seed.ts`. Metadata is built by:

- **Bookings:** `findUnique({ where: { id: bookingId } })` using context IDs
- **Providers / services:** Direct refs from context (no re-query by email)
- **Recipients:** Initial user lookup by email only (to resolve `notification.userId`)

Booking-related seed metadata includes:

| Field | Purpose |
|-------|---------|
| `bookingId`, `eventId`, `serviceId`, `providerId`, `customerUserId`, `providerUserId` | Navigation UUIDs |
| `eventName`, `eventType`, `eventDate`, `guestCount` | Event display |
| `serviceType`, `serviceName` (when distinct), `businessName`, `customerName` | Service / party display |
| `amount` | Payment / quote display (when available on booking) |
| `screen` | Navigation hint |

---

## Enum Values Without Implementation

The following `NotificationType` values exist in the schema but have **no notification creation logic** and were intentionally left unchanged:

`OTP_SENT`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `LOGIN_ALERT`, `BOOKING_QUOTE_CONFIRMED`, `GENERAL` (except dev test endpoint), `SUB_SERVICE_APPROVED`, `SUB_SERVICE_REJECTED`

---

## Future Notifications

When implementing any future notification types, follow the same metadata design pattern:

- Always include stable entity identifiers (UUIDs) required for navigation.
- Include useful display fields when already available.
- Never rely on names or emails for navigation.
- Keep notification metadata consistent across the entire application.
- Use `customerUserId`, `providerUserId`, and `actorUserId` for all user UUIDs; reserve `targetUserId` for role-ambiguous recipients only.

All user-related identifiers in notification metadata follow a unified naming convention:

- `customerUserId`
- `providerUserId`
- `actorUserId` (if applicable)

This ensures consistent frontend routing across all notification types.
