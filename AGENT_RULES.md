# EVENTY AI ENGINEERING RULES

You are working on "Eventy" — a production-grade backend for an event services marketplace connecting Customers, Service Providers, and Admins.

==================================================
STACK
=====

* NestJS 10
* TypeScript
* Prisma ORM 5.22
* PostgreSQL 17
* Redis (ioredis)
* Cloudinary
* JWT Authentication
* Passport.js
* Swagger
* cache-manager v7

==================================================
ARCHITECTURE RULES
==================

Global modules:

* DatabaseModule (PrismaService)
* CacheModule (Redis)
* SharedModule (CloudinaryService)

Feature modules:

* Auth
* Users
* Providers
* Services
* Bookings
* Admin
* Notifications
* Reports

Rules:

* Controllers NEVER contain business logic
* Services contain business logic
* DTOs use class-validator + class-transformer
* Prisma is the ONLY ORM
* Avoid raw SQL unless transactional locking is required
* Reuse existing patterns before creating abstractions
* Follow existing naming conventions

==================================================
RESPONSE RULES
==============

Every service method returns:

{
message,
data
}

Global TransformInterceptor wraps responses.

Success list format:

{
success: true,
statusCode,
message,
data: {
items,
meta
},
timestamp
}

Success single format:

{
success: true,
statusCode,
message,
data: {},
timestamp
}

Error format:

{
success: false,
statusCode,
message,
data: null,
timestamp
}

==================================================
SECURITY RULES
==============

NEVER expose:

* passwordHash
* googleId
* internal secrets

Use select/include carefully.

Sensitive endpoints must use throttling.

Validate uploaded file magic bytes.
Do NOT trust mimetype alone.

==================================================
SOFT DELETE RULES
=================

Models:

* User
* Service
* SubService

must use:

deletedAt DateTime?

Never use prisma.delete() for production flows.

All queries must include:

where: {
deletedAt: null
}

==================================================
PAGINATION RULES
================

PaginationDto already exists:

{
page,
limit,
sortBy,
order
}

Use pagination in ALL list endpoints.

==================================================
BOOKING RULES
=============

Booking creation MUST:

* use Prisma transaction
* perform atomic capacity checks
* prevent overbooking
* enforce idempotency

Check duplicate booking:

same customerId

* same serviceId
* same eventDate
* status in (PENDING, ACCEPTED)

Return 409 Conflict if duplicate exists.

==================================================
BOOKING CONFLICT DETECTION
==========================

Before accepting booking:

* check overlapping accepted bookings
* return conflicting booking details
* include overlapping time window

==================================================
NOTIFICATION RULES
==================

Every important business action must:

1. Save DB notification
2. Attempt push notification
3. Log audit action if needed

Use NotificationType enum.

NotificationService must be injectable globally.

==================================================
NOTIFICATION ARCHITECTURE
=========================

Use event-driven architecture.

Flow:

Business Logic
↓
Event Emitter
↓
Notification Listener
↓
NotificationService
↓
Transport Provider

Transport providers:

* ConsoleNotificationProvider
* FirebaseNotificationProvider

NotificationService MUST NOT directly depend on Firebase.

==================================================
FIREBASE FAILURE STRATEGY
=========================

Push notifications are NON-BLOCKING.

If Firebase fails:

* NEVER fail business operation
* NEVER rollback transaction
* NEVER throw to controller

Instead:

* save DB notification
* log warning in terminal
* optionally mark notification as FAILED

==================================================
DEVELOPMENT MODE
================

If Firebase credentials are missing:

* still execute notification pipeline
* print notification logs in terminal

Example:

[Notification Fallback]
Status: FAILED_TO_SEND
Reason: Missing Firebase credentials

==================================================
AUDIT RULES
===========

AuditLog must be used for:

* provider approve/reject
* service approve/reject
* user block/unblock
* booking status change

Include:

* action
* entity
* entityId
* oldValue
* newValue
* userId
* ipAddress

==================================================
INTERCEPTOR RULES
=================

Global interceptors should support:

* request logging
* execution timing
* actor tracking
* before hooks
* after hooks
* failure hooks

Use decorators:

* @TrackAction()
* @Notify()
* @Audit()

==================================================
REQUEST LOGGING
===============

Log:

* method
* path
* statusCode
* responseTime
* userId

Use NestJS Logger only.

==================================================
ENV VALIDATION
==============

Application bootstrap must validate:

* DATABASE_URL
* JWT_SECRET
* JWT_REFRESH_SECRET
* REDIS_URL
* CLOUDINARY_CLOUD_NAME
* CLOUDINARY_API_KEY
* CLOUDINARY_API_SECRET

Exit application if missing.

==================================================
SWAGGER RULES
=============

Every endpoint must include in english:

* @ApiOperation
* @ApiResponse

Protected endpoints must include:

* @ApiBearerAuth

==================================================
CODE GENERATION RULES
=====================

When generating code:

* follow existing project structure
* avoid unnecessary abstractions
* provide production-ready code
<!-- * no placeholder comments
* no pseudo-code -->

CODE DETAIL RULE:

* small fixes → show changed lines only
* large refactors → full function
* new files → complete file

Always include file path comment:

// src/modules/example/example.service.ts

==================================================
TERMINAL COMMANDS
=================

All terminal commands must be PowerShell-compatible.

==================================================
IMPORTANT
=========

This is a production-grade scalable backend.

Prioritize:

* maintainability
* scalability
* transactional safety
* consistency
* clean architecture
* reusable patterns
