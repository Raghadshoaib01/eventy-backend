// src/database/seeds/events.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds Events and their associated Bookings, covering all required scenarios:
//
//  Event 1 – "Al-Rashid Wedding"     → Venue (HALL) only
//  Event 2 – "Haddad Engagement"     → Venue (HALL) + DECORATION (with sub-services)
//  Event 3 – "Ahmad's Birthday"      → Services only, NO venue (FOOD + PHOTOGRAPHY)
//  Event 4 – "Haddad Graduation"     → Complex mix: FOOD + DECORATION + SOUND + FAVORS
//
// Atomicity: each event (event row + all its bookings + booking items) is
// wrapped in a single Prisma interactive transaction.  A failure in any step
// rolls back the entire event so the database never holds partial data.
//
// Idempotency: read-only resolution of services/time-slots happens BEFORE
// the transaction opens.  Inside the transaction every write is guarded by a
// findFirst check so re-running the seed is always safe.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BookingStatus,
  EventStatus,
  EventType,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { SeededCustomer } from './customers.seed';
import { SeededEventsContext } from './seed-context.types';

// ─── Shared transaction-client type ──────────────────────────────────────────
// Prisma's transaction client exposes the same model delegates as PrismaClient
// but omits the top-level connection/transaction methods.

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ─── Helper: resolve service + provider (READ — runs before the tx) ───────────

async function resolveService(
  prisma: PrismaClient,
  providerEmail: string,
  typeName: string,
) {
  const user = await prisma.user.findUnique({ where: { email: providerEmail } });
  if (!user) throw new Error(`Provider user not found: ${providerEmail}`);

  const provider = await prisma.serviceProvider.findUnique({
    where: { userId: user.id },
  });
  if (!provider)
    throw new Error(`ServiceProvider not found for: ${providerEmail}`);

  const serviceType = await prisma.serviceType.findUnique({
    where: { name: typeName },
  });
  if (!serviceType) throw new Error(`ServiceType not found: ${typeName}`);

  const service = await prisma.service.findFirst({
    where: { providerId: provider.id, serviceTypeId: serviceType.id },
  });
  if (!service)
    throw new Error(
      `Service [${typeName}] not found for provider: ${providerEmail}`,
    );

  return { provider, service };
}

// ─── Helper: find first time slot for a service (READ — runs before the tx) ──

async function findTimeSlot(prisma: PrismaClient, serviceId: string) {
  const avail = await prisma.serviceAvailability.findFirst({
    where: { serviceId, hasSlots: true },
    include: { timeSlots: true },
  });
  return avail?.timeSlots?.[0] ?? null;
}

// ─── Helper: idempotent booking upsert (WRITE — runs inside the tx) ──────────

async function upsertBooking(
  tx: TxClient,
  data: {
    customerId: string;
    providerId: string;
    serviceId: string;
    eventId: string;
    timeSlotId?: string | null;
    customerNotes?: string;
    totalAmount: number;
    status: BookingStatus;
    acceptedAt?: Date | null;
    completedAt?: Date | null;
  },
): Promise<string> {
  const existing = await tx.booking.findFirst({
    where: {
      customerId: data.customerId,
      serviceId: data.serviceId,
      eventId: data.eventId,
    },
  });
  if (existing) return existing.id;

  const booking = await tx.booking.create({
    data: {
      customerId: data.customerId,
      providerId: data.providerId,
      serviceId: data.serviceId,
      eventId: data.eventId,
      timeSlotId: data.timeSlotId,
      customerNotes: data.customerNotes,
      totalAmount: data.totalAmount,
      finalAmount: data.totalAmount,
      status: data.status,
      acceptedAt: data.acceptedAt,
      completedAt: data.completedAt,
    },
  });
  return booking.id;
}

// ─── Helper: idempotent booking items (WRITE — runs inside the tx) ───────────

async function addBookingItems(
  tx: TxClient,
  bookingId: string,
  serviceId: string,
  items: { subServiceName: string; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    const sub = await tx.subService.findFirst({
      where: { serviceId, name: item.subServiceName },
    });
    if (!sub) {
      console.warn(
        `    ⚠️  SubService '${item.subServiceName}' not found — skipping item.`,
      );
      continue;
    }

    const existing = await tx.bookingItem.findFirst({
      where: { bookingId, subServiceId: sub.id },
    });
    if (existing) continue;

    const totalPrice = sub.pricePerUnit * item.quantity;
    await tx.bookingItem.create({
      data: {
        bookingId,
        subServiceId: sub.id,
        quantity: item.quantity,
        unitPrice: sub.pricePerUnit,
        finalUnitPrice: sub.pricePerUnit,
        totalPrice,
        finalTotalPrice: totalPrice,
      },
    });
  }
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export async function seedEvents(
  prisma: PrismaClient,
  customers: SeededCustomer[],
): Promise<SeededEventsContext> {
  const ahmad = customers.find((c) => c.email === 'ahmad@customer.eventy.com');
  const dina = customers.find((c) => c.email === 'dina@customer.eventy.com');

  if (!ahmad || !dina) {
    throw new Error('Expected customers not found. Run customer seed first.');
  }

  let ahmadWeddingHall = '';
  let dinaEngagementHall = '';
  let dinaEngagementDecoration = '';
  let ahmadBirthdayFood = '';
  let ahmadBirthdayPhoto = '';

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 1: Al-Rashid Wedding  —  HALL booking only
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n  📅 Event 1: Al-Rashid Wedding (HALL only)');

  // Pre-tx reads
  const hallRoyal = await resolveService(prisma, 'khalid@royalevents.jo', 'HALL');
  const hallRoyalSlot = await findTimeSlot(prisma, hallRoyal.service.id);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.event.findFirst({
      where: { customerId: ahmad.userId, name: 'Al-Rashid Wedding' },
    });
    const event1 =
      existing ??
      (await tx.event.create({
        data: {
          customerId: ahmad.userId,
          name: 'Al-Rashid Wedding',
          eventType: EventType.WEDDING,
          eventDate: new Date('2026-09-15'),
          eventStartTime: '18:00',
          eventEndTime: '02:00',
          eventLocation: 'Royal Events Venue, Amman',
          numberOfGuests: 400,
          customerNotes: 'Large wedding, need the grand ballroom.',
          status: EventStatus.DRAFT,
        },
      }));

    ahmadWeddingHall = await upsertBooking(tx, {
      customerId: ahmad.userId,
      providerId: hallRoyal.provider.id,
      serviceId: hallRoyal.service.id,
      eventId: event1.id,
      timeSlotId: hallRoyalSlot?.id,
      customerNotes: 'Ballroom evening booking for 400 guests.',
      totalAmount: 2500.0,
      status: BookingStatus.CONFIRMED,
      acceptedAt: new Date('2026-07-01'),
    });
    console.log('    ✅ Booking [HALL]:', ahmadWeddingHall);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 2: Haddad Engagement  —  HALL + DECORATION (with sub-services)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n  📅 Event 2: Haddad Engagement (HALL + DECORATION with sub-services)');

  // Pre-tx reads
  const hallGarden = await resolveService(prisma, 'rania@gardenpalace.jo', 'HALL');
  const hallGardenSlot = await findTimeSlot(prisma, hallGarden.service.id);
  const decGrande = await resolveService(prisma, 'tarek@grandecor.jo', 'DECORATION');

  await prisma.$transaction(async (tx) => {
    const existing = await tx.event.findFirst({
      where: { customerId: dina.userId, name: 'Haddad Engagement Party' },
    });
    const event2 =
      existing ??
      (await tx.event.create({
        data: {
          customerId: dina.userId,
          name: 'Haddad Engagement Party',
          eventType: EventType.ENGAGEMENT,
          eventDate: new Date('2026-10-10'),
          eventStartTime: '19:00',
          eventEndTime: '23:59',
          eventLocation: 'Garden Palace Venue, Jerash',
          numberOfGuests: 120,
          customerNotes: 'Intimate engagement in a garden setting.',
          status: EventStatus.DRAFT,
        },
      }));

    dinaEngagementHall = await upsertBooking(tx, {
      customerId: dina.userId,
      providerId: hallGarden.provider.id,
      serviceId: hallGarden.service.id,
      eventId: event2.id,
      timeSlotId: hallGardenSlot?.id,
      customerNotes: 'Evening garden slot for the engagement.',
      totalAmount: 1500.0,
      status: BookingStatus.CONFIRMED,
      acceptedAt: new Date('2026-07-05'),
    });
    console.log('    ✅ Booking [HALL - Garden Palace]:', dinaEngagementHall);

    dinaEngagementDecoration = await upsertBooking(tx, {
      customerId: dina.userId,
      providerId: decGrande.provider.id,
      serviceId: decGrande.service.id,
      eventId: event2.id,
      customerNotes: 'Floral backdrop wall + centrepieces for 12 tables.',
      totalAmount: 350.0 + 40.0 * 12,
      status: BookingStatus.QUOTE_SENT,
    });
    await addBookingItems(tx, dinaEngagementDecoration, decGrande.service.id, [
      { subServiceName: 'Floral Backdrop Wall', quantity: 1 },
      { subServiceName: 'Centrepiece (Per Table)', quantity: 12 },
    ]);
    console.log('    ✅ Booking [DECORATION] with items:', dinaEngagementDecoration);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 3: Ahmad's Birthday  —  NO venue (FOOD + PHOTOGRAPHY only)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n  📅 Event 3: Ahmad Birthday (FOOD + PHOTOGRAPHY — no venue)');

  // Pre-tx reads
  const foodNabaah = await resolveService(prisma, 'anas@nabaah.com', 'FOOD');
  const foodNabaahSlot = await findTimeSlot(prisma, foodNabaah.service.id);
  const photoLens = await resolveService(prisma, 'lina@lenscraft.jo', 'PHOTOGRAPHY');
  const photoLensSlot = await findTimeSlot(prisma, photoLens.service.id);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.event.findFirst({
      where: { customerId: ahmad.userId, name: "Ahmad's Birthday Celebration" },
    });
    const event3 =
      existing ??
      (await tx.event.create({
        data: {
          customerId: ahmad.userId,
          name: "Ahmad's Birthday Celebration",
          eventType: EventType.BIRTHDAY,
          eventDate: new Date('2026-11-20'),
          eventStartTime: '17:00',
          eventEndTime: '22:00',
          eventLocation: 'Private Villa, Amman',
          numberOfGuests: 60,
          customerNotes: 'House birthday party, need food and a photographer.',
          status: EventStatus.DRAFT,
        },
      }));

    ahmadBirthdayFood = await upsertBooking(tx, {
      customerId: ahmad.userId,
      providerId: foodNabaah.provider.id,
      serviceId: foodNabaah.service.id,
      eventId: event3.id,
      timeSlotId: foodNabaahSlot?.id,
      customerNotes: 'Birthday dinner for 60 guests.',
      totalAmount: 18.0 * 60 + 3.5 * 60,
      status: BookingStatus.CONFIRMED,
      acceptedAt: new Date('2026-08-01'),
    });
    await addBookingItems(tx, ahmadBirthdayFood, foodNabaah.service.id, [
      { subServiceName: 'Deluxe Cassita Platter', quantity: 60 },
      { subServiceName: 'Fresh Berry Juice', quantity: 60 },
    ]);
    console.log('    ✅ Booking [FOOD] with items:', ahmadBirthdayFood);

    ahmadBirthdayPhoto = await upsertBooking(tx, {
      customerId: ahmad.userId,
      providerId: photoLens.provider.id,
      serviceId: photoLens.service.id,
      eventId: event3.id,
      timeSlotId: photoLensSlot?.id,
      customerNotes: 'Photo session + premium album for birthday.',
      totalAmount: 250.0 + 120.0,
      status: BookingStatus.PENDING,
    });
    await addBookingItems(tx, ahmadBirthdayPhoto, photoLens.service.id, [
      { subServiceName: 'Photo Session (4 Hours)', quantity: 1 },
      { subServiceName: 'Photo Album (Premium)', quantity: 1 },
    ]);
    console.log('    ✅ Booking [PHOTOGRAPHY] with items:', ahmadBirthdayPhoto);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 4: Haddad Graduation  —  Complex mix (FOOD + DECORATION + SOUND + FAVORS)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n  📅 Event 4: Haddad Graduation (FOOD + DECORATION + SOUND + FAVORS)');

  // Pre-tx reads
  const foodHadidi = await resolveService(prisma, 'sara@hadidi-kitchen.com', 'FOOD');
  const decPetals = await resolveService(prisma, 'maya@petalsandlight.jo', 'DECORATION');
  const soundBeat = await resolveService(prisma, 'faris@beatmaster.jo', 'SOUND');
  const favorsGift = await resolveService(prisma, 'nour@giftwrap.jo', 'FAVORS');

  await prisma.$transaction(async (tx) => {
    const existing = await tx.event.findFirst({
      where: { customerId: dina.userId, name: 'Dina Graduation Celebration' },
    });
    const event4 =
      existing ??
      (await tx.event.create({
        data: {
          customerId: dina.userId,
          name: 'Dina Graduation Celebration',
          eventType: EventType.GRADUATION,
          eventDate: new Date('2026-12-05'),
          eventStartTime: '15:00',
          eventEndTime: '21:00',
          eventLocation: "Dina's Home, Amman",
          numberOfGuests: 80,
          customerNotes: 'Outdoor garden graduation party with full services.',
          status: EventStatus.DRAFT,
        },
      }));

    const b4a = await upsertBooking(tx, {
      customerId: dina.userId,
      providerId: foodHadidi.provider.id,
      serviceId: foodHadidi.service.id,
      eventId: event4.id,
      customerNotes: 'Traditional Jordanian menu for 80 guests.',
      totalAmount: 45.0 * 8 + 8.0 * 80 + 12.0 * 20,
      status: BookingStatus.PENDING,
    });
    await addBookingItems(tx, b4a, foodHadidi.service.id, [
      { subServiceName: 'Mansaf (Large Tray)', quantity: 8 },
      { subServiceName: 'Knafeh Dessert Station', quantity: 80 },
      { subServiceName: 'Mezze Platter', quantity: 20 },
    ]);
    console.log('    ✅ Booking [FOOD - Hadidi] with items:', b4a);

    const b4b = await upsertBooking(tx, {
      customerId: dina.userId,
      providerId: decPetals.provider.id,
      serviceId: decPetals.service.id,
      eventId: event4.id,
      customerNotes: 'Boho garden vibes — arch + lanterns + balloons.',
      totalAmount: 220.0 + 85.0 + 60.0 * 2,
      status: BookingStatus.PENDING,
    });
    await addBookingItems(tx, b4b, decPetals.service.id, [
      { subServiceName: 'Pampas Grass Arch', quantity: 1 },
      { subServiceName: 'Lantern Pathway Set', quantity: 1 },
      { subServiceName: 'Balloon Garland (3 m)', quantity: 2 },
    ]);
    console.log('    ✅ Booking [DECORATION - Petals] with items:', b4b);

    const b4c = await upsertBooking(tx, {
      customerId: dina.userId,
      providerId: soundBeat.provider.id,
      serviceId: soundBeat.service.id,
      eventId: event4.id,
      customerNotes: 'DJ for 6 hours, graduation playlist.',
      totalAmount: 450.0,
      status: BookingStatus.PENDING,
    });
    console.log('    ✅ Booking [SOUND]:', b4c);

    const b4d = await upsertBooking(tx, {
      customerId: dina.userId,
      providerId: favorsGift.provider.id,
      serviceId: favorsGift.service.id,
      eventId: event4.id,
      customerNotes: '80 custom name boxes as graduation gifts.',
      totalAmount: 4.5 * 80,
      status: BookingStatus.PENDING,
    });
    await addBookingItems(tx, b4d, favorsGift.service.id, [
      { subServiceName: 'Custom Name Box', quantity: 80 },
    ]);
    console.log('    ✅ Booking [FAVORS] with items:', b4d);
  });

  console.log('\n✅ All events and bookings seeded.');

  return {
    bookingIds: {
      ahmadWeddingHall,
      dinaEngagementHall,
      dinaEngagementDecoration,
      ahmadBirthdayFood,
      ahmadBirthdayPhoto,
    },
  };
}
