// src/database/seeds/reviews.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds Reviews (ratings + comments) for COMPLETED bookings, and a sample
// providerReply for some of them.
//
// Reviews require a booking with status COMPLETED and a 1:1 relation
// (bookingId is unique on Review).  Since the existing bookings seeded by
// events.seed.ts are mostly CONFIRMED / PENDING, we first update a subset
// to COMPLETED (idempotently) so we have valid targets.
//
//  Booking                       │ Rating │ Comment                  │ Reply?
//  ──────────────────────────────┼────────┼──────────────────────────┼───────
//  Ahmad HALL (Al-Rashid Wedding)│ 5      │ Stunning venue!          │ ✅
//  Dina HALL (Engagement)        │ 4      │ Beautiful setting…       │ ✅
//  Dina DECORATION (Engagement)  │ 3      │ Decent, some delays      │ ✅
//  Ahmad FOOD (Birthday)         │ 5      │ Incredible food!         │ ✅
//  Ahmad PHOTOGRAPHY (Birthday)  │ 2      │ Mediocre photos…         │ ✅
//
// Idempotency: Review has a unique constraint on bookingId.
// ─────────────────────────────────────────────────────────────────────────────

import { BookingStatus, PrismaClient } from '@prisma/client';
import { SeededEventsContext } from './seed-context.types';
import { SeededCustomer } from './customers.seed';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function upsertReview(
  prisma: PrismaClient,
  data: {
    bookingId: string;
    customerId: string;
    serviceId: string;
    rating: number;
    comment?: string;
    providerReply?: string;
    createdAt?: Date;
  },
): Promise<string> {
  // Ensure booking is COMPLETED
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
  });
  if (!booking) {
    console.warn(`  ⚠️  Booking ${data.bookingId} not found — skipping review.`);
    return '';
  }

  if (booking.status !== BookingStatus.COMPLETED) {
    await prisma.booking.update({
      where: { id: data.bookingId },
      data: {
        status:      BookingStatus.COMPLETED,
        completedAt: data.createdAt ?? new Date(),
        acceptedAt:  booking.acceptedAt ?? new Date(),
      },
    });
    console.log(`  🔄  Booking ${data.bookingId} marked COMPLETED for review.`);
  }

  const existing = await prisma.review.findUnique({
    where: { bookingId: data.bookingId },
  });
  if (existing) {
    console.log(`  ⚠️  Review exists for booking ${data.bookingId}, skipping.`);
    return existing.id;
  }

  const review = await prisma.review.create({
    data: {
      bookingId:     data.bookingId,
      customerId:    data.customerId,
      serviceId:     data.serviceId,
      rating:        data.rating,
      comment:       data.comment,
      providerReply: data.providerReply,
    },
  });

  // Update service aggregate rating
  const allReviews = await prisma.review.findMany({
    where: { serviceId: data.serviceId },
    select: { rating: true },
  });
  const avgRating =
    allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  await prisma.service.update({
    where: { id: data.serviceId },
    data: {
      rating:       Math.round(avgRating * 10) / 10,
      totalReviews: allReviews.length,
    },
  });

  console.log(
    `  ✅ Review [${data.rating}★]: booking ${data.bookingId}`,
    data.providerReply ? '(with reply)' : '',
  );
  return review.id;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export async function seedReviews(
  prisma: PrismaClient,
  eventsCtx: SeededEventsContext,
  customers: SeededCustomer[],
): Promise<void> {
  console.log('\n  ⭐  Seeding Reviews…');

  const ahmad = customers.find((c) => c.email === 'ahmad@customer.eventy.com');
  const dina  = customers.find((c) => c.email === 'dina@customer.eventy.com');
  if (!ahmad || !dina)
    throw new Error('Expected customers not found. Run customer seed first.');

  const {
    ahmadWeddingHall,
    dinaEngagementHall,
    dinaEngagementDecoration,
    ahmadBirthdayFood,
    ahmadBirthdayPhoto,
  } = eventsCtx.bookingIds;

  // Fetch service IDs from bookings
  const resolveServiceId = async (bookingId: string) => {
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b) throw new Error(`Booking not found: ${bookingId}`);
    return b.serviceId;
  };

  const hallSvcId = await resolveServiceId(ahmadWeddingHall);
  const hallGardenId = await resolveServiceId(dinaEngagementHall);
  const decSvcId  = await resolveServiceId(dinaEngagementDecoration);
  const foodSvcId = await resolveServiceId(ahmadBirthdayFood);
  const photoSvcId= await resolveServiceId(ahmadBirthdayPhoto);

  // ── Review 1: Ahmad → HALL (5★) ───────────────────────────────────────────
  await upsertReview(prisma, {
    bookingId:    ahmadWeddingHall,
    customerId:   ahmad.userId,
    serviceId:    hallSvcId,
    rating:       5,
    comment:      'Absolutely stunning venue! The grand ballroom exceeded every expectation. The staff were professional and accommodating throughout the entire event.',
    providerReply:'Thank you so much, Ahmad! It was an honour hosting the Al-Rashid wedding. We hope to welcome you again soon! 🌹',
    createdAt:    new Date('2026-09-16'),
  });

  // ── Review 2: Dina → HALL Garden Palace (4★) ─────────────────────────────
  await upsertReview(prisma, {
    bookingId:    dinaEngagementHall,
    customerId:   dina.userId,
    serviceId:    hallGardenId,
    rating:       4,
    comment:      'Beautiful garden setting with lovely lighting. The venue was well-maintained and the team was helpful. Minor issue with parking but everything else was perfect.',
    providerReply:'Thank you for your kind feedback, Dina! We have since improved our parking arrangements. Wishing you all the best! 🌸',
    createdAt:    new Date('2026-10-11'),
  });

  // ── Review 3: Dina → DECORATION (3★) ─────────────────────────────────────
  await upsertReview(prisma, {
    bookingId:    dinaEngagementDecoration,
    customerId:   dina.userId,
    serviceId:    decSvcId,
    rating:       3,
    comment:      'The floral backdrop was beautiful but setup took much longer than expected. The centrepieces were nice but a couple were slightly different from the sample. Average experience overall.',
    providerReply:'We sincerely apologise for the setup delays, Dina. We have restructured our team scheduling and are confident in delivering a better experience next time.',
    createdAt:    new Date('2026-10-12'),
  });

  // ── Review 4: Ahmad → FOOD Nabaah (5★) ───────────────────────────────────
  await upsertReview(prisma, {
    bookingId:    ahmadBirthdayFood,
    customerId:   ahmad.userId,
    serviceId:    foodSvcId,
    rating:       5,
    comment:      'Incredible food quality! Every single guest complimented the Cassita platters and the fresh berry juice was a huge hit. Will definitely book again for our next celebration.',
    providerReply:'Ahmad, you made our whole team smile with this review! 🎉 Thank you for choosing NABAAH Catering – we look forward to serving you and your family again.',
    createdAt:    new Date('2026-11-21'),
  });

  // ── Review 5: Ahmad → PHOTOGRAPHY (2★) ───────────────────────────────────
  await upsertReview(prisma, {
    bookingId:    ahmadBirthdayPhoto,
    customerId:   ahmad.userId,
    serviceId:    photoSvcId,
    rating:       2,
    comment:      'Honestly disappointed. The photographer missed key moments and the album quality was below what was shown in the sample. Expected much more for the price.',
    providerReply:'Ahmad, we are sorry to hear you were not satisfied. We would love the opportunity to make this right. Please contact us directly so we can discuss a resolution.',
    createdAt:    new Date('2026-11-22'),
  });

  console.log('\n✅ All reviews seeded.');
}
