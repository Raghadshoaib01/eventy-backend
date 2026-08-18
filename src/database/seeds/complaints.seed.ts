// src/database/seeds/complaints.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds Complaints covering all ComplaintTargetType and ComplaintStatus values.
//
//  C1  PROVIDER    / PENDING        – Ahmad  vs  Photography provider
//  C2  SERVICE     / IN_PROGRESS    – Dina   vs  Decoration service
//  C3  BOOKING     / RESOLVED       – Ahmad  about his HALL booking
//  C4  PACKAGE_BOOKING / RESOLVED   – Dina   about cancelled package booking
//  C5  CUSTOMER    / REJECTED       – Provider about a customer (filed by admin)
//  C6  GENERAL     / PENDING        – Dina   general platform feedback
//  C7  SERVICE     / RESOLVED       – Ahmad  about food quality
//
// Idempotency: looked up by (complainantId + targetType + subject).
// ─────────────────────────────────────────────────────────────────────────────

import {
  ComplaintStatus,
  ComplaintTargetType,
  PrismaClient,
} from '@prisma/client';
import { SeededCustomer } from './customers.seed';
import { SeededEventsContext } from './seed-context.types';
import { SeededPackagesContext } from './packages.seed';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function upsertComplaint(
  prisma: PrismaClient,
  data: {
    complainantId: string;
    targetType: ComplaintTargetType;
    targetId?: string;
    bookingId?: string;
    packageEventBookingId?: string;
    subject: string;
    description: string;
    status: ComplaintStatus;
    adminReply?: string;
    handledByUserId?: string;
    resolvedAt?: Date;
  },
): Promise<string> {
  const existing = await prisma.complaint.findFirst({
    where: {
      complainantId: data.complainantId,
      targetType:    data.targetType,
      subject:       data.subject,
    },
  });
  if (existing) {
    console.log(`  ⚠️  Complaint exists [${data.targetType}/${data.status}], skipping.`);
    return existing.id;
  }

  const complaint = await prisma.complaint.create({
    data: {
      complainantId:    data.complainantId,
      targetType:       data.targetType,
      targetId:         data.targetId,
      bookingId:        data.bookingId,
      packageEventBookingId: data.packageEventBookingId,
      subject:          data.subject,
      description:      data.description,
      status:           data.status,
      adminReply:       data.adminReply,
      handledByUserId:  data.handledByUserId,
      resolvedAt:       data.resolvedAt,
    },
  });

  console.log(
    `  ✅ Complaint [${data.targetType}/${data.status}]:`,
    complaint.id,
  );
  return complaint.id;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveProvider(prisma: PrismaClient, email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Provider user not found: ${email}`);
  const prov = await prisma.serviceProvider.findUnique({ where: { userId: user.id } });
  if (!prov) throw new Error(`Provider not found: ${email}`);
  return { userId: user.id, providerId: prov.id };
}

async function resolveService(
  prisma: PrismaClient,
  providerEmail: string,
  typeName: string,
): Promise<string> {
  const { providerId } = await resolveProvider(prisma, providerEmail);
  const st = await prisma.serviceType.findUnique({ where: { name: typeName } });
  if (!st) throw new Error(`ServiceType not found: ${typeName}`);
  const svc = await prisma.service.findFirst({
    where: { providerId, serviceTypeId: st.id },
  });
  if (!svc) throw new Error(`Service not found: ${typeName} / ${providerEmail}`);
  return svc.id;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export async function seedComplaints(
  prisma: PrismaClient,
  customers: SeededCustomer[],
  eventsCtx: SeededEventsContext,
  packages: SeededPackagesContext,
): Promise<void> {
  console.log('\n  📣 Seeding Complaints…');

  const ahmad = customers.find((c) => c.email === 'ahmad@eventy.com');
  const dina  = customers.find((c) => c.email === 'dina@eventy.com');
  if (!ahmad || !dina)
    throw new Error('Expected customers not found. Run customer seed first.');

  // Resolve admin
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@eventy.com' },
  });
  if (!adminUser) throw new Error('Admin user not found. Run admin seed first.');

  // Resolve provider IDs
  const { providerId: linaPrvId, userId: linaUserId } = await resolveProvider(
    prisma, 'lina@eventy.com',
  );
  const { providerId: tarekPrvId } = await resolveProvider(
    prisma, 'tarek@eventy.com',
  );
  const { providerId: khalidPrvId } = await resolveProvider(
    prisma, 'khalid@eventy.com',
  );

  // Resolve service IDs
  const decSvcId  = await resolveService(prisma, 'tarek@eventy.com', 'DECORATION');
  const foodSvcId = await resolveService(prisma, 'anas@eventy.com',    'FOOD');

  const {
    ahmadWeddingHall,
    ahmadBirthdayPhoto,
  } = eventsCtx.bookingIds;

  // ── C1: PROVIDER / PENDING ────────────────────────────────────────────────
  await upsertComplaint(prisma, {
    complainantId: ahmad.userId,
    targetType:    ComplaintTargetType.PROVIDER,
    targetId:      linaPrvId,
    subject:       'Photographer arrived 2 hours late',
    description:
      'The photographer from LensCraft was supposed to arrive at 17:00 but showed up at 19:00 without prior notice. This caused us to miss the first hour of the birthday party. Very unprofessional.',
    status: ComplaintStatus.PENDING,
  });

  // ── C2: SERVICE / IN_PROGRESS ─────────────────────────────────────────────
  await upsertComplaint(prisma, {
    complainantId: dina.userId,
    targetType:    ComplaintTargetType.SERVICE,
    targetId:      decSvcId,
    subject:       'Decoration did not match the agreed design',
    description:
      'The decoration setup for my engagement was significantly different from the samples I approved. The floral arch was the wrong colour, and several centrepieces were missing. I have photos as evidence.',
    status:         ComplaintStatus.IN_PROGRESS,
    adminReply:     'We have contacted the provider and are currently reviewing the evidence provided. We will update you within 48 hours.',
    handledByUserId: adminUser.id,
  });

  // ── C3: BOOKING / RESOLVED ────────────────────────────────────────────────
  await upsertComplaint(prisma, {
    complainantId: ahmad.userId,
    targetType:    ComplaintTargetType.BOOKING,
    targetId:      khalidPrvId,
    bookingId:     ahmadWeddingHall,
    subject:       'Double-charged for hall booking',
    description:
      'I was charged twice for the same hall booking (Al-Rashid Wedding). Both transactions appear on my bank statement. Please refund the duplicate charge immediately.',
    status:         ComplaintStatus.RESOLVED,
    adminReply:     'We have verified the duplicate charge and issued a full refund for the second transaction. The refund should appear in 3–5 business days. We apologise for the inconvenience.',
    handledByUserId: adminUser.id,
    resolvedAt:     new Date('2026-07-20'),
  });

  // ── C4: PACKAGE_BOOKING / RESOLVED ───────────────────────────────────────
  await upsertComplaint(prisma, {
    complainantId:    dina.userId,
    targetType:       ComplaintTargetType.PACKAGE_BOOKING,
    packageEventBookingId: packages.cancelledPkgBookingId,
    subject:          'Refund not received after package booking cancellation',
    description:
      'I cancelled my Royal Wedding Package booking over two weeks ago but have not received my refund yet. The cancellation was within the allowed window as per policy.',
    status:         ComplaintStatus.RESOLVED,
    adminReply:     'The refund has been processed and should appear within 5 business days. We have also issued a 50 JOD platform credit as an apology for the delay.',
    handledByUserId: adminUser.id,
    resolvedAt:     new Date('2026-07-25'),
  });

  // ── C5: CUSTOMER / REJECTED ───────────────────────────────────────────────
  // Provider files complaint against customer behaviour
  await upsertComplaint(prisma, {
    complainantId: linaUserId,   // photographer (provider) files against Ahmad
    targetType:    ComplaintTargetType.CUSTOMER,
    targetId:      ahmad.userId,
    subject:       'Customer left abusive review without valid grounds',
    description:
      'The customer (Ahmad Al-Rashid) left a 2-star review claiming "mediocre photos" after we delivered the full agreed album on time. He also made rude remarks directly to our staff at the event.',
    status:         ComplaintStatus.REJECTED,
    adminReply:     'After reviewing both sides, we found no policy violation in the customer\'s review. The review reflects their subjective opinion. Complaint closed.',
    handledByUserId: adminUser.id,
    resolvedAt:     new Date('2026-07-22'),
  });

  // ── C6: GENERAL / PENDING ─────────────────────────────────────────────────
  await upsertComplaint(prisma, {
    complainantId: dina.userId,
    targetType:    ComplaintTargetType.GENERAL,
    subject:       'Search filters not working correctly',
    description:
      'The location filter in the app does not return nearby providers correctly. I set my location to Jerash but results keep showing providers from Amman. This is a platform bug that needs fixing.',
    status: ComplaintStatus.PENDING,
  });

  // ── C7: SERVICE / RESOLVED ────────────────────────────────────────────────
  await upsertComplaint(prisma, {
    complainantId: ahmad.userId,
    targetType:    ComplaintTargetType.SERVICE,
    targetId:      foodSvcId,
    subject:       'Food was served cold at the birthday event',
    description:
      'Despite confirming a specific serving time, the Cassita platters were served cold. The catering team arrived late and did not have adequate warming equipment. Several guests complained.',
    status:         ComplaintStatus.RESOLVED,
    adminReply:     'We have mediated with NABAAH Catering. They have offered a 25% discount on your next booking and will ensure proper warming equipment at all future events.',
    handledByUserId: adminUser.id,
    resolvedAt:     new Date('2026-11-25'),
  });

  console.log('\n✅ All complaints seeded.');
}
