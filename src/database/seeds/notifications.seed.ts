// src/database/seeds/notifications.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds representative notifications for customers and providers so testers
// can see the full notification inbox without needing to trigger real flows.
//
// Idempotent: each notification is uniquely identified by (userId + type + title).
// ─────────────────────────────────────────────────────────────────────────────

import {
  DeliveryStatus,
  NotificationType,
  PrismaClient,
} from '@prisma/client';

interface NotifDef {
  userEmail: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead?: boolean;
  deliveryStatus?: DeliveryStatus;
  metadata?: Record<string, unknown>;
}

const NOTIFICATIONS: NotifDef[] = [
  // ── Customer: Ahmad ─────────────────────────────────────────────────────────
  {
    userEmail: 'ahmad@customer.eventy.com',
    title: 'Booking Confirmed 🎉',
    body: 'Your hall booking for "Al-Rashid Wedding" has been confirmed by Royal Events Venue.',
    type: NotificationType.BOOKING_ACCEPTED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
    metadata: { eventName: 'Al-Rashid Wedding', serviceType: 'HALL' },
  },
  {
    userEmail: 'ahmad@customer.eventy.com',
    title: 'Quote Received',
    body: 'NABAAH Catering has sent a quote for your birthday food order. Review it now.',
    type: NotificationType.BOOKING_QUOTE_SENT,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    metadata: { eventName: "Ahmad's Birthday Celebration", serviceType: 'FOOD' },
  },
  {
    userEmail: 'ahmad@customer.eventy.com',
    title: 'Welcome to Eventy!',
    body: 'Your account is verified. Start planning your first event today.',
    type: NotificationType.ACCOUNT_VERIFIED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
  },

  // ── Customer: Dina ──────────────────────────────────────────────────────────
  {
    userEmail: 'dina@customer.eventy.com',
    title: 'Booking Confirmed 🎉',
    body: 'Your hall booking for "Haddad Engagement Party" has been confirmed by Garden Palace.',
    type: NotificationType.BOOKING_ACCEPTED,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    metadata: { eventName: 'Haddad Engagement Party', serviceType: 'HALL' },
  },
  {
    userEmail: 'dina@customer.eventy.com',
    title: 'Quote Received — Decoration',
    body: 'Grande Décor has sent a quote for your decoration request. Tap to review.',
    type: NotificationType.BOOKING_QUOTE_SENT,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    metadata: { eventName: 'Haddad Engagement Party', serviceType: 'DECORATION' },
  },
  {
    userEmail: 'dina@customer.eventy.com',
    title: 'Payment Confirmed',
    body: 'Payment for Garden Palace venue has been successfully processed.',
    type: NotificationType.PAYMENT_CONFIRMED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
  },

  // ── Provider: Khalid (Royal Events Venue) ───────────────────────────────────
  {
    userEmail: 'khalid@royalevents.jo',
    title: 'New Booking Request',
    body: 'Ahmad Al-Rashid has requested to book your ballroom for a wedding on 15 Sep 2026.',
    type: NotificationType.BOOKING_CREATED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
    metadata: { guestCount: 400, eventType: 'WEDDING' },
  },
  {
    userEmail: 'khalid@royalevents.jo',
    title: 'Account Approved ✅',
    body: 'Congratulations! Your provider account has been approved by the Eventy team.',
    type: NotificationType.PROVIDER_APPROVED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
  },

  // ── Provider: Anas (NABAAH Catering) ────────────────────────────────────────
  {
    userEmail: 'anas@nabaah.com',
    title: 'New Booking Request',
    body: 'Ahmad Al-Rashid has requested catering for a birthday event on 20 Nov 2026.',
    type: NotificationType.BOOKING_CREATED,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    metadata: { guestCount: 60, eventType: 'BIRTHDAY' },
  },
  {
    userEmail: 'anas@nabaah.com',
    title: 'Service Approved',
    body: 'Your FOOD service has been reviewed and approved. Customers can now discover it.',
    type: NotificationType.SERVICE_APPROVED,
    isRead: true,
    deliveryStatus: DeliveryStatus.SENT,
  },

  // ── Provider: Lina (LensCraft Studio) ───────────────────────────────────────
  {
    userEmail: 'lina@lenscraft.jo',
    title: 'New Booking Request',
    body: 'Ahmad Al-Rashid has requested a 4-hour photo session for his birthday.',
    type: NotificationType.BOOKING_CREATED,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
  },

  // ── Admin ────────────────────────────────────────────────────────────────────
  {
    userEmail: 'admin@eventy.com',
    title: 'New Provider Registration',
    body: 'A new provider "BeatMaster Audio" has registered and is awaiting your review.',
    type: NotificationType.ADMIN_NEW_PROVIDER_REQUEST,
    isRead: false,
    deliveryStatus: DeliveryStatus.SENT,
    metadata: { providerEmail: 'faris@beatmaster.jo' },
  },
];

export async function seedNotifications(prisma: PrismaClient): Promise<void> {
  // Build a quick email → userId map
  const emails = [...new Set(NOTIFICATIONS.map((n) => n.userEmail))];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.email, u.id]));

  let created = 0;
  let skipped = 0;

  for (const def of NOTIFICATIONS) {
    const userId = userMap.get(def.userEmail);
    if (!userId) {
      console.warn(`  ⚠️  User not found for notification: ${def.userEmail}`);
      continue;
    }

    const existing = await prisma.notification.findFirst({
      where: { userId, type: def.type, title: def.title },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.notification.create({
      data: {
        userId,
        title: def.title,
        body: def.body,
        type: def.type,
        isRead: def.isRead ?? false,
        deliveryStatus: def.deliveryStatus ?? DeliveryStatus.SENT,
        metadata: def.metadata as object | undefined,
      },
    });
    created++;
  }

  console.log(`✅ Notifications: ${created} created, ${skipped} skipped.`);
}
