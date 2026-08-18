// src/database/seeds/notifications.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds representative notifications for customers and providers so testers
// can see the full notification inbox without needing to trigger real flows.
//
// Idempotent: each notification is uniquely identified by (userId + type + title).
// Metadata is resolved from seed context IDs and direct entity lookups by ID.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DeliveryStatus,
  NotificationType,
  PrismaClient,
} from '@prisma/client';
import {
  SeedNotificationContext,
  SeededProviderEntityRef,
  SeededServiceEntityRef,
} from './seed-context.types';

interface NotifDef {
  userEmail: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead?: boolean;
  deliveryStatus?: DeliveryStatus;
  resolveMetadata: (
    prisma: PrismaClient,
    ctx: SeedNotificationContext,
    recipient: { id: string; email: string },
  ) => Promise<Record<string, unknown> | undefined>;
}

function serviceDisplayFields(service: {
  description: string | null;
  serviceType: { name: string };
}): { serviceType: string; serviceName?: string } {
  const serviceType = service.serviceType.name;
  const description = service.description?.trim();
  if (description && description !== serviceType) {
    return { serviceType, serviceName: description };
  }
  return { serviceType };
}

async function loadBookingMetadata(
  prisma: PrismaClient,
  bookingId: string,
  screen: string,
): Promise<Record<string, unknown> | undefined> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      event: true,
      customer: { select: { id: true, fullName: true } },
      provider: { include: { user: { select: { id: true } } } },
      service: { include: { serviceType: { select: { name: true } } } },
    },
  });

  if (!booking?.eventId || !booking.event) return undefined;

  return {
    screen,
    bookingId: booking.id,
    eventId: booking.eventId,
    serviceId: booking.serviceId,
    providerId: booking.providerId,
    customerUserId: booking.customerId,
    providerUserId: booking.provider.user.id,
    eventName: booking.event.name,
    eventType: booking.event.eventType,
    eventDate: booking.event.eventDate.toISOString(),
    guestCount: booking.event.numberOfGuests,
    ...serviceDisplayFields(booking.service),
    customerName: booking.customer.fullName,
    businessName: booking.provider.businessName,
    amount: booking.finalAmount ?? booking.totalAmount,
  };
}

function buildProviderMetadata(
  ref: SeededProviderEntityRef,
  screen: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    screen,
    providerId: ref.providerId,
    providerUserId: ref.providerUserId,
    businessName: ref.businessName,
    ...extra,
  };
}

function buildServiceMetadata(
  ref: SeededServiceEntityRef,
  screen: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    screen,
    serviceId: ref.serviceId,
    providerId: ref.providerId,
    providerUserId: ref.providerUserId,
    serviceType: ref.serviceType,
    businessName: ref.businessName,
    ...extra,
  };
}

const NOTIFICATIONS: NotifDef[] = [
  // ── Customer: Ahmad ─────────────────────────────────────────────────────────
  {
    userEmail: 'ahmad@eventy.com',
    title: 'Booking Confirmed 🎉',
    body: 'Your hall booking for "Al-Rashid Wedding" has been confirmed by Royal Events Venue.',
    type: NotificationType.BOOKING_ACCEPTED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (prisma, ctx) =>
      loadBookingMetadata(
        prisma,
        ctx.events.bookingIds.ahmadWeddingHall,
        'booking-details',
      ),
  },
  {
    userEmail: 'ahmad@eventy.com',
    title: 'Quote Received',
    body: 'NABAAH Catering has sent a quote for your birthday food order. Review it now.',
    type: NotificationType.BOOKING_QUOTE_SENT,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (prisma, ctx) =>
      loadBookingMetadata(
        prisma,
        ctx.events.bookingIds.ahmadBirthdayFood,
        'booking-quote',
      ),
  },
  {
    userEmail: 'ahmad@eventy.com',
    title: 'Welcome to Eventy!',
    body: 'Your account is verified. Start planning your first event today.',
    type: NotificationType.ACCOUNT_VERIFIED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: async (_prisma, _ctx, recipient) => ({
      screen: 'profile',
      customerUserId: recipient.id,
      email: recipient.email,
    }),
  },

  // ── Customer: Dina ──────────────────────────────────────────────────────────
  {
    userEmail: 'dina@eventy.com',
    title: 'Booking Confirmed 🎉',
    body: 'Your hall booking for "Haddad Engagement Party" has been confirmed by Garden Palace.',
    type: NotificationType.BOOKING_ACCEPTED,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (prisma, ctx) =>
      loadBookingMetadata(
        prisma,
        ctx.events.bookingIds.dinaEngagementHall,
        'booking-details',
      ),
  },
  {
    userEmail: 'dina@eventy.com',
    title: 'Quote Received — Decoration',
    body: 'Grande Décor has sent a quote for your decoration request. Tap to review.',
    type: NotificationType.BOOKING_QUOTE_SENT,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (prisma, ctx) =>
      loadBookingMetadata(
        prisma,
        ctx.events.bookingIds.dinaEngagementDecoration,
        'booking-quote',
      ),
  },
  {
    userEmail: 'dina@eventy.com',
    title: 'Payment Confirmed',
    body: 'Payment for Garden Palace venue has been successfully processed.',
    type: NotificationType.PAYMENT_CONFIRMED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (prisma, ctx) =>
      loadBookingMetadata(
        prisma,
        ctx.events.bookingIds.dinaEngagementHall,
        'booking-payment',
      ),
  },

  // ── Provider: Khalid (Royal Events Venue) ───────────────────────────────────
  {
    userEmail: 'khalid@eventy.com',
    title: 'New Booking Request',
    body: 'Ahmad Al-Rashid has requested to book your ballroom for a wedding on 15 Sep 2026.',
    type: NotificationType.BOOKING_CREATED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (prisma, ctx) =>
      loadBookingMetadata(
        prisma,
        ctx.events.bookingIds.ahmadWeddingHall,
        'booking-details',
      ),
  },
  {
    userEmail: 'khalid@eventy.com',
    title: 'Account Approved ✅',
    body: 'Congratulations! Your provider account has been approved by the Eventy team.',
    type: NotificationType.PROVIDER_APPROVED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (_prisma, ctx) =>
      Promise.resolve(
        buildProviderMetadata(ctx.providers.khalidRoyalEvents, 'provider-profile', {
          approvalStatus: 'APPROVED',
        }),
      ),
  },

  // ── Provider: Anas (NABAAH Catering) ────────────────────────────────────────
  {
    userEmail: 'anas@eventy.com',
    title: 'New Booking Request',
    body: 'Ahmad Al-Rashid has requested catering for a birthday event on 20 Nov 2026.',
    type: NotificationType.BOOKING_CREATED,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (prisma, ctx) =>
      loadBookingMetadata(
        prisma,
        ctx.events.bookingIds.ahmadBirthdayFood,
        'booking-details',
      ),
  },
  {
    userEmail: 'anas@eventy.com',
    title: 'Service Approved',
    body: 'Your FOOD service has been reviewed and approved. Customers can now discover it.',
    type: NotificationType.SERVICE_APPROVED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (_prisma, ctx) =>
      Promise.resolve(
        buildServiceMetadata(ctx.providers.anasFoodService, 'service-details', {
          approvalStatus: 'APPROVED',
        }),
      ),
  },

  // ── Provider: Lina (LensCraft Studio) ───────────────────────────────────────
  {
    userEmail: 'lina@eventy.com',
    title: 'New Booking Request',
    body: 'Ahmad Al-Rashid has requested a 4-hour photo session for his birthday.',
    type: NotificationType.BOOKING_CREATED,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (prisma, ctx) =>
      loadBookingMetadata(
        prisma,
        ctx.events.bookingIds.ahmadBirthdayPhoto,
        'booking-details',
      ),
  },

  // ── Admin ────────────────────────────────────────────────────────────────────
  {
    userEmail: 'admin@eventy.com',
    title: 'New Provider Registration',
    body: 'A new provider "Odat Sound Rentals" has registered and is awaiting your review.',
    type: NotificationType.ADMIN_NEW_PROVIDER_REQUEST,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    resolveMetadata: (_prisma, ctx) =>
      Promise.resolve(
        buildProviderMetadata(ctx.providers.beatmasterAudio, 'provider-review', {
          approvalStatus: 'PENDING',
        }),
      ),
  },
];

export async function seedNotifications(
  prisma: PrismaClient,
  ctx: SeedNotificationContext,
): Promise<void> {
  const emails = [...new Set(NOTIFICATIONS.map((n) => n.userEmail))];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.email, u]));

  let created = 0;
  let skipped = 0;

  for (const def of NOTIFICATIONS) {
    const user = userMap.get(def.userEmail);
    if (!user) {
      console.warn(`  ⚠️  User not found for notification: ${def.userEmail}`);
      continue;
    }

    const existing = await prisma.notification.findFirst({
      where: { userId: user.id, type: def.type, title: def.title },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const metadata = await def.resolveMetadata(prisma, ctx, user);

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: def.title,
        body: def.body,
        type: def.type,
        isRead: def.isRead ?? false,
        deliveryStatus: def.deliveryStatus ?? DeliveryStatus.SENT,
        metadata: metadata as object | undefined,
      },
    });
    created++;
  }

  console.log(`✅ Notifications: ${created} created, ${skipped} skipped.`);
}
