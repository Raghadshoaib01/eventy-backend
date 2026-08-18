// src/database/seeds/payments.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds Payments against existing Bookings covering all PaymentStatus values
// using only CASH and BANK_TRANSFER payment methods.
//
//  Booking                        │ Method        │ Status     │ Discount?
//  ───────────────────────────────┼───────────────┼────────────┼──────────
//  Ahmad's HALL booking (CONFIRM) │ BANK_TRANSFER │ PAID       │ D1 (15%)
//  Dina's HALL booking  (CONFIRM) │ CASH          │ PAID       │ none
//  Dina's DECORATION   (QUOTE)   │ CASH          │ PENDING    │ none
//  Ahmad's FOOD birthday(CONFIRM) │ BANK_TRANSFER │ PAID       │ D2 (20%)
//  Ahmad's PHOTO birthday(PEND)   │ CASH          │ FAILED     │ none
//  Grad booking [0]               │ BANK_TRANSFER │ PROCESSING │ none
//  Grad booking [1]               │ BANK_TRANSFER │ REFUNDED   │ none
//  Grad booking [2]               │ CASH          │ CANCELLED  │ none
//
// Idempotency: one payment per booking (unique constraint in schema).
// ─────────────────────────────────────────────────────────────────────────────

import {
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';
import { SeededEventsContext } from './seed-context.types';
import { SeededDiscountsContext } from './discounts.seed';

// ─── Exported context ─────────────────────────────────────────────────────────

export interface SeededPaymentsContext {
  paidHallPaymentId: string;
  paidFoodPaymentId: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function upsertPayment(
  prisma: PrismaClient,
  data: {
    bookingId: string;
    payerId: string;
    amount: number;
    subtotalAmount: number;
    method: PaymentMethod;
    status: PaymentStatus;
    discountId?: string;
    discountAmount?: number;
    providerReference?: string;
    paidAt?: Date;
  },
): Promise<string> {
  const existing = await prisma.payment.findUnique({
    where: { bookingId: data.bookingId },
  });
  if (existing) {
    console.log('  ⚠️  Payment exists for booking, skipping:', data.bookingId);
    return existing.id;
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId:         data.bookingId,
      payerId:           data.payerId,
      amount:            data.amount,
      subtotalAmount:    data.subtotalAmount,
      method:            data.method,
      status:            data.status,
      discountId:        data.discountId,
      discountAmount:    data.discountAmount,
      providerReference: data.providerReference,
      paidAt:            data.paidAt,
    },
  });
  console.log(
    `  ✅ Payment [${data.method}/${data.status}]:`,
    payment.id,
    `→ booking ${data.bookingId}`,
  );
  return payment.id;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export async function seedPayments(
  prisma: PrismaClient,
  eventsCtx: SeededEventsContext,
  discounts: SeededDiscountsContext,
): Promise<SeededPaymentsContext> {
  console.log('\n  💳 Seeding Payments…');

  // Resolve customer user IDs
  const ahmadUser = await prisma.user.findUnique({
    where: { email: 'ahmad@eventy.com' },
  });
  const dinaUser = await prisma.user.findUnique({
    where: { email: 'dina@eventy.com' },
  });
  if (!ahmadUser || !dinaUser)
    throw new Error('Customer users not found. Run customer seed first.');

  const {
    ahmadWeddingHall,
    dinaEngagementHall,
    dinaEngagementDecoration,
    ahmadBirthdayFood,
    ahmadBirthdayPhoto,
  } = eventsCtx.bookingIds;

  // ── P1: Ahmad HALL → BANK_TRANSFER / PAID (with D1 discount 15%) ─────────
  const hallSubtotal = 2500;
  const hallDiscount = Math.round(hallSubtotal * 0.15 * 100) / 100;
  const paidHallPaymentId = await upsertPayment(prisma, {
    bookingId:         ahmadWeddingHall,
    payerId:           ahmadUser.id,
    subtotalAmount:    hallSubtotal,
    discountId:        discounts.serviceDiscountActiveId,
    discountAmount:    hallDiscount,
    amount:            hallSubtotal - hallDiscount,
    method:            PaymentMethod.BANK_TRANSFER,
    status:            PaymentStatus.PAID,
    providerReference: 'TXN-KHAL-20260710-001',
    paidAt:            new Date('2026-07-10'),
  });

  // ── P2: Dina HALL (Garden Palace) → CASH / PAID ───────────────────────────
  await upsertPayment(prisma, {
    bookingId:         dinaEngagementHall,
    payerId:           dinaUser.id,
    subtotalAmount:    1500,
    amount:            1500,
    method:            PaymentMethod.CASH,
    status:            PaymentStatus.PAID,
    providerReference: 'TXN-GRDP-20260715-002',
    paidAt:            new Date('2026-07-15'),
  });

  // ── P3: Dina DECORATION (quote sent) → CASH / PENDING ────────────────────
  const decTotal = 350 + 40 * 12; // 830 JOD
  await upsertPayment(prisma, {
    bookingId:      dinaEngagementDecoration,
    payerId:        dinaUser.id,
    subtotalAmount: decTotal,
    amount:         decTotal,
    method:         PaymentMethod.CASH,
    status:         PaymentStatus.PENDING,
  });

  // ── P4: Ahmad FOOD birthday → BANK_TRANSFER / PAID (with D2 discount 20%) ─
  const foodSubtotal = 18 * 60 + 3.5 * 60; // 1290 JOD
  const foodDiscount = Math.round(foodSubtotal * 0.2 * 100) / 100;
  const paidFoodPaymentId = await upsertPayment(prisma, {
    bookingId:         ahmadBirthdayFood,
    payerId:           ahmadUser.id,
    subtotalAmount:    foodSubtotal,
    discountId:        discounts.companyFoodDiscountId,
    discountAmount:    foodDiscount,
    amount:            foodSubtotal - foodDiscount,
    method:            PaymentMethod.BANK_TRANSFER,
    status:            PaymentStatus.PAID,
    providerReference: 'TXN-NABAAH-20260801-003',
    paidAt:            new Date('2026-08-01'),
  });

  // ── P5: Ahmad PHOTOGRAPHY birthday → CASH / FAILED ───────────────────────
  const photoTotal = 250 + 120; // 370 JOD
  await upsertPayment(prisma, {
    bookingId:      ahmadBirthdayPhoto,
    payerId:        ahmadUser.id,
    subtotalAmount: photoTotal,
    amount:         photoTotal,
    method:         PaymentMethod.CASH,
    status:         PaymentStatus.FAILED,
  });

  // ── P6–P8: Extra bookings covering PROCESSING / REFUNDED / CANCELLED ────────
  // Use Event 4 bookings (Dina's graduation).
  const dinaGradBookings = await prisma.booking.findMany({
    where: {
      eventId: (
        await prisma.event.findFirst({
          where: { name: 'Dina Graduation Celebration' },
        })
      )?.id,
    },
    orderBy: { createdAt: 'asc' },
  });

  // P6: First grad booking → BANK_TRANSFER / PROCESSING
  if (dinaGradBookings[0]) {
    const b = dinaGradBookings[0];
    const existingP6 = await prisma.payment.findUnique({
      where: { bookingId: b.id },
    });
    if (!existingP6) {
      await prisma.payment.create({
        data: {
          bookingId:      b.id,
          payerId:        dinaUser.id,
          subtotalAmount: b.totalAmount,
          amount:         b.totalAmount,
          method:         PaymentMethod.BANK_TRANSFER,
          status:         PaymentStatus.PROCESSING,
        },
      });
      console.log('  ✅ Payment [BANK_TRANSFER/PROCESSING]:', b.id);
    } else {
      console.log('  ⚠️  Payment P6 exists, skipping.');
    }
  }

  // P7: Second grad booking → BANK_TRANSFER / REFUNDED
  if (dinaGradBookings[1]) {
    const b = dinaGradBookings[1];
    const existingP7 = await prisma.payment.findUnique({
      where: { bookingId: b.id },
    });
    if (!existingP7) {
      await prisma.payment.create({
        data: {
          bookingId:      b.id,
          payerId:        dinaUser.id,
          subtotalAmount: b.totalAmount,
          amount:         b.totalAmount,
          method:         PaymentMethod.BANK_TRANSFER,
          status:         PaymentStatus.REFUNDED,
          providerReference: 'REFUND-REF-20260720',
        },
      });
      console.log('  ✅ Payment [BANK_TRANSFER/REFUNDED]:', b.id);
    } else {
      console.log('  ⚠️  Payment P7 exists, skipping.');
    }
  }

  // P8: Third grad booking → CASH / CANCELLED
  if (dinaGradBookings[2]) {
    const b = dinaGradBookings[2];
    const existingP8 = await prisma.payment.findUnique({
      where: { bookingId: b.id },
    });
    if (!existingP8) {
      await prisma.payment.create({
        data: {
          bookingId:      b.id,
          payerId:        dinaUser.id,
          subtotalAmount: b.totalAmount,
          amount:         b.totalAmount,
          method:         PaymentMethod.CASH,
          status:         PaymentStatus.CANCELLED,
        },
      });
      console.log('  ✅ Payment [CASH/CANCELLED]:', b.id);
    } else {
      console.log('  ⚠️  Payment P8 exists, skipping.');
    }
  }

  console.log('\n✅ All payments seeded.');

  return { paidHallPaymentId, paidFoodPaymentId };
}
