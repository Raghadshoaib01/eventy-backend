// src/database/seeds/packages.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds Packages with their items and PackageBookings, covering all scenarios:
//
//  Package 1 – "Royal Wedding Package"  → ACTIVE, FLAT_SUM strategy
//    • PackageBooking A → CONFIRMED   (Ahmad)
//    • PackageBooking B → CANCELLED   (Dina)
//
//  Package 2 – "Graduation Bundle"      → ACTIVE, GUEST_BASED strategy
//    • PackageBooking C → IN_PROGRESS  (Dina)
//    • PackageBooking D → PENDING_PAYMENT (Ahmad)
//
//  Package 3 – "Birthday Starter Pack"  → PENDING_APPROVAL (no bookings)
//  Package 4 – "Engagement Elegance"    → REJECTED         (no bookings)
//  Package 5 – "Draft Sound & Favors"   → DRAFT            (no bookings)
//
// Idempotency: each record is looked up by name / customer + package before
// being created.
// ─────────────────────────────────────────────────────────────────────────────

import {
  PackageBookingStatus,
  PackagePricingStrategy,
  PackageStatus,
  PrismaClient,
} from '@prisma/client';
import { SeededCustomer } from './customers.seed';

// ─── Exported context ─────────────────────────────────────────────────────────

export interface SeededPackagesContext {
  royalWeddingPackageId: string;
  graduationBundleId: string;
  confirmedPkgBookingId: string;   // Ahmad → Royal Wedding Package (CONFIRMED)
  inProgressPkgBookingId: string;  // Dina  → Graduation Bundle    (IN_PROGRESS)
  cancelledPkgBookingId: string;   // Dina  → Royal Wedding Package (CANCELLED)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveProvider(prisma: PrismaClient, email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Provider user not found: ${email}`);
  const provider = await prisma.serviceProvider.findUnique({
    where: { userId: user.id },
  });
  if (!provider) throw new Error(`ServiceProvider not found for: ${email}`);
  return provider;
}

async function resolveService(
  prisma: PrismaClient,
  providerId: string,
  typeName: string,
) {
  const serviceType = await prisma.serviceType.findUnique({
    where: { name: typeName },
  });
  if (!serviceType) throw new Error(`ServiceType not found: ${typeName}`);
  const service = await prisma.service.findFirst({
    where: { providerId, serviceTypeId: serviceType.id },
  });
  if (!service)
    throw new Error(`Service [${typeName}] not found for provider: ${providerId}`);
  return service;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export async function seedPackages(
  prisma: PrismaClient,
  customers: SeededCustomer[],
): Promise<SeededPackagesContext> {
  console.log('\n  📦 Seeding Packages…');

  const ahmad = customers.find((c) => c.email === 'ahmad@customer.eventy.com');
  const dina  = customers.find((c) => c.email === 'dina@customer.eventy.com');
  if (!ahmad || !dina)
    throw new Error('Expected customers not found. Run customer seed first.');

  // ── Resolve providers ──────────────────────────────────────────────────────
  const khalidProv = await resolveProvider(prisma, 'khalid@royalevents.jo');
  const anasProv   = await resolveProvider(prisma, 'anas@nabaah.com');
  const tarekProv  = await resolveProvider(prisma, 'tarek@grandecor.jo');
  const linaProv   = await resolveProvider(prisma, 'lina@lenscraft.jo');
  const saraProv   = await resolveProvider(prisma, 'sara@hadidi-kitchen.com');
  const farisProv  = await resolveProvider(prisma, 'faris@beatmaster.jo');
  const nourProv   = await resolveProvider(prisma, 'nour@giftwrap.jo');
  const mayaProv   = await resolveProvider(prisma, 'maya@petalsandlight.jo');

  // ── Resolve services ───────────────────────────────────────────────────────
  const hallSvc    = await resolveService(prisma, khalidProv.id, 'HALL');
  const foodNabaah = await resolveService(prisma, anasProv.id,   'FOOD');
  const decGrande  = await resolveService(prisma, tarekProv.id,  'DECORATION');
  const photoLens  = await resolveService(prisma, linaProv.id,   'PHOTOGRAPHY');
  const foodHadidi = await resolveService(prisma, saraProv.id,   'FOOD');
  const soundBeat  = await resolveService(prisma, farisProv.id,  'SOUND');
  const favorsGift = await resolveService(prisma, nourProv.id,   'FAVORS');
  const decPetals  = await resolveService(prisma, mayaProv.id,   'DECORATION');

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 1: Royal Wedding Package — ACTIVE, FLAT_SUM
  // ══════════════════════════════════════════════════════════════════════════
  let royalWeddingPackageId = '';

  const existingPkg1 = await prisma.package.findFirst({
    where: { providerId: khalidProv.id, name: 'Royal Wedding Package' },
  });

  if (existingPkg1) {
    royalWeddingPackageId = existingPkg1.id;
    console.log('  ⚠️  Package 1 exists, skipping:', existingPkg1.name);
  } else {
    const pkg1 = await prisma.package.create({
      data: {
        providerId: khalidProv.id,
        name: 'Royal Wedding Package',
        description:
          'Complete wedding experience: premium hall, catering, decoration, and photography – all in one bundle.',
        status: PackageStatus.ACTIVE,
        pricingStrategy: PackagePricingStrategy.FLAT_SUM,
        reviewNote: 'Approved – meets all quality standards.',
        reviewedAt: new Date('2026-06-01'),
        attachedItems: {
          create: [
            { serviceId: hallSvc.id,    isRequired: true,  addedByUserId: khalidProv.userId },
            { serviceId: foodNabaah.id, isRequired: true,  addedByUserId: khalidProv.userId },
            { serviceId: decGrande.id,  isRequired: false, addedByUserId: khalidProv.userId },
            { serviceId: photoLens.id,  isRequired: false, addedByUserId: khalidProv.userId },
          ],
        },
      },
    });
    royalWeddingPackageId = pkg1.id;
    console.log('  ✅ Package 1 created:', pkg1.name, '|', pkg1.id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 2: Graduation Bundle — ACTIVE, GUEST_BASED
  // ══════════════════════════════════════════════════════════════════════════
  let graduationBundleId = '';

  const existingPkg2 = await prisma.package.findFirst({
    where: { providerId: saraProv.id, name: 'Graduation Bundle' },
  });

  if (existingPkg2) {
    graduationBundleId = existingPkg2.id;
    console.log('  ⚠️  Package 2 exists, skipping:', existingPkg2.name);
  } else {
    const pkg2 = await prisma.package.create({
      data: {
        providerId: saraProv.id,
        name: 'Graduation Bundle',
        description:
          'Everything you need for an unforgettable graduation party: food, decoration, sound, and gifts.',
        status: PackageStatus.ACTIVE,
        pricingStrategy: PackagePricingStrategy.GUEST_BASED,
        reviewNote: 'Approved – graduation-focused bundle.',
        reviewedAt: new Date('2026-06-15'),
        attachedItems: {
          create: [
            { serviceId: foodHadidi.id, isRequired: true,  addedByUserId: saraProv.userId },
            { serviceId: decPetals.id,  isRequired: true,  addedByUserId: saraProv.userId },
            { serviceId: soundBeat.id,  isRequired: false, addedByUserId: saraProv.userId },
            { serviceId: favorsGift.id, isRequired: false, addedByUserId: saraProv.userId },
          ],
        },
      },
    });
    graduationBundleId = pkg2.id;
    console.log('  ✅ Package 2 created:', pkg2.name, '|', pkg2.id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 3: Birthday Starter Pack — PENDING_APPROVAL
  // ══════════════════════════════════════════════════════════════════════════
  const existingPkg3 = await prisma.package.findFirst({
    where: { providerId: anasProv.id, name: 'Birthday Starter Pack' },
  });

  if (!existingPkg3) {
    const pkg3 = await prisma.package.create({
      data: {
        providerId: anasProv.id,
        name: 'Birthday Starter Pack',
        description:
          'Compact birthday package: catering + photography for intimate celebrations up to 50 guests.',
        status: PackageStatus.PENDING_APPROVAL,
        pricingStrategy: PackagePricingStrategy.FLAT_SUM,
        attachedItems: {
          create: [
            { serviceId: foodNabaah.id, isRequired: true,  addedByUserId: anasProv.userId },
            { serviceId: photoLens.id,  isRequired: false, addedByUserId: anasProv.userId },
          ],
        },
      },
    });
    console.log('  ✅ Package 3 created (PENDING_APPROVAL):', pkg3.name);
  } else {
    console.log('  ⚠️  Package 3 exists, skipping:', existingPkg3.name);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 4: Engagement Elegance — REJECTED
  // ══════════════════════════════════════════════════════════════════════════
  const existingPkg4 = await prisma.package.findFirst({
    where: { providerId: tarekProv.id, name: 'Engagement Elegance' },
  });

  if (!existingPkg4) {
    const pkg4 = await prisma.package.create({
      data: {
        providerId: tarekProv.id,
        name: 'Engagement Elegance',
        description: 'Elegant engagement bundle: decoration + sound system.',
        status: PackageStatus.REJECTED,
        pricingStrategy: PackagePricingStrategy.FLAT_SUM,
        reviewNote:
          'Rejected – incomplete service details. Please update and resubmit.',
        reviewedAt: new Date('2026-06-20'),
        attachedItems: {
          create: [
            { serviceId: decGrande.id, isRequired: true,  addedByUserId: tarekProv.userId },
            { serviceId: soundBeat.id, isRequired: false, addedByUserId: tarekProv.userId },
          ],
        },
      },
    });
    console.log('  ✅ Package 4 created (REJECTED):', pkg4.name);
  } else {
    console.log('  ⚠️  Package 4 exists, skipping:', existingPkg4.name);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 5: Draft Sound & Favors Bundle — DRAFT
  // ══════════════════════════════════════════════════════════════════════════
  const existingPkg5 = await prisma.package.findFirst({
    where: { providerId: farisProv.id, name: 'Draft Sound & Favors Bundle' },
  });

  if (!existingPkg5) {
    const pkg5 = await prisma.package.create({
      data: {
        providerId: farisProv.id,
        name: 'Draft Sound & Favors Bundle',
        description:
          'Work in progress: sound system + custom favors for any celebration.',
        status: PackageStatus.DRAFT,
        pricingStrategy: PackagePricingStrategy.FLAT_SUM,
        attachedItems: {
          create: [
            { serviceId: soundBeat.id,  isRequired: true,  addedByUserId: farisProv.userId },
            { serviceId: favorsGift.id, isRequired: false, addedByUserId: farisProv.userId },
          ],
        },
      },
    });
    console.log('  ✅ Package 5 created (DRAFT):', pkg5.name);
  } else {
    console.log('  ⚠️  Package 5 exists, skipping:', existingPkg5.name);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE BOOKINGS
  // ══════════════════════════════════════════════════════════════════════════

  // Resolve events for linking
  const ahmadWeddingEvent = await prisma.event.findFirst({
    where: { customerId: ahmad.userId, name: 'Al-Rashid Wedding' },
  });
  const dinaGradEvent = await prisma.event.findFirst({
    where: { customerId: dina.userId, name: 'Dina Graduation Celebration' },
  });

  // ── Booking A: Ahmad → Royal Wedding Package (CONFIRMED) ─────────────────
  let confirmedPkgBookingId = '';
  const existingPkgBookA = await prisma.packageBooking.findFirst({
    where: { packageId: royalWeddingPackageId, customerId: ahmad.userId },
  });

  if (existingPkgBookA) {
    confirmedPkgBookingId = existingPkgBookA.id;
    console.log('  ⚠️  PackageBooking A exists, skipping.');
  } else {
    const subtotalA   = 2500 + 1080 + 830;
    const discAmtA    = Math.round(subtotalA * 0.1 * 100) / 100;
    const pkgBookA = await prisma.packageBooking.create({
      data: {
        packageId:             royalWeddingPackageId,
        customerId:            ahmad.userId,
        eventId:               ahmadWeddingEvent?.id ?? undefined,
        guestCount:            400,
        status:                PackageBookingStatus.CONFIRMED,
        hallPrice:             2500,
        optionalServicesTotal: 830,
        subtotal:              subtotalA,
        discountAmount:        discAmtA,
        totalAmount:           subtotalA - discAmtA,
        selectedItems: {
          create: [
            { serviceId: hallSvc.id,    wasRequired: true,  priceAtBooking: 2500 },
            { serviceId: foodNabaah.id, wasRequired: true,  priceAtBooking: 1080 },
            { serviceId: decGrande.id,  wasRequired: false, priceAtBooking: 830  },
          ],
        },
      },
    });
    confirmedPkgBookingId = pkgBookA.id;
    console.log('  ✅ PackageBooking A (CONFIRMED):', pkgBookA.id);
  }

  // ── Booking B: Dina → Royal Wedding Package (CANCELLED) ──────────────────
  let cancelledPkgBookingId = '';
  const existingPkgBookB = await prisma.packageBooking.findFirst({
    where: { packageId: royalWeddingPackageId, customerId: dina.userId },
  });

  if (existingPkgBookB) {
    cancelledPkgBookingId = existingPkgBookB.id;
    console.log('  ⚠️  PackageBooking B exists, skipping.');
  } else {
    const subtotalB = 2500 + 600;
    const pkgBookB = await prisma.packageBooking.create({
      data: {
        packageId:             royalWeddingPackageId,
        customerId:            dina.userId,
        guestCount:            120,
        status:                PackageBookingStatus.CANCELLED,
        hallPrice:             2500,
        optionalServicesTotal: 0,
        subtotal:              subtotalB,
        totalAmount:           subtotalB,
        cancelledAt:           new Date('2026-07-10'),
        cancellationReason:    'Customer changed venue preference.',
        selectedItems: {
          create: [
            { serviceId: hallSvc.id,    wasRequired: true, priceAtBooking: 2500 },
            { serviceId: foodNabaah.id, wasRequired: true, priceAtBooking: 600  },
          ],
        },
      },
    });
    cancelledPkgBookingId = pkgBookB.id;
    console.log('  ✅ PackageBooking B (CANCELLED):', pkgBookB.id);
  }

  // ── Booking C: Dina → Graduation Bundle (IN_PROGRESS) ────────────────────
  let inProgressPkgBookingId = '';
  const existingPkgBookC = await prisma.packageBooking.findFirst({
    where: { packageId: graduationBundleId, customerId: dina.userId },
  });

  if (existingPkgBookC) {
    inProgressPkgBookingId = existingPkgBookC.id;
    console.log('  ⚠️  PackageBooking C exists, skipping.');
  } else {
    const subtotalC = 3600 + 425 + 450 + 360;
    const pkgBookC = await prisma.packageBooking.create({
      data: {
        packageId:             graduationBundleId,
        customerId:            dina.userId,
        eventId:               dinaGradEvent?.id ?? undefined,
        guestCount:            80,
        status:                PackageBookingStatus.IN_PROGRESS,
        hallPrice:             0,
        optionalServicesTotal: 450 + 360,
        subtotal:              subtotalC,
        totalAmount:           subtotalC,
        selectedItems: {
          create: [
            { serviceId: foodHadidi.id, wasRequired: true,  priceAtBooking: 3600 },
            { serviceId: decPetals.id,  wasRequired: true,  priceAtBooking: 425  },
            { serviceId: soundBeat.id,  wasRequired: false, priceAtBooking: 450  },
            { serviceId: favorsGift.id, wasRequired: false, priceAtBooking: 360  },
          ],
        },
      },
    });
    inProgressPkgBookingId = pkgBookC.id;
    console.log('  ✅ PackageBooking C (IN_PROGRESS):', pkgBookC.id);
  }

  // ── Booking D: Ahmad → Graduation Bundle (PENDING_PAYMENT) ───────────────
  const existingPkgBookD = await prisma.packageBooking.findFirst({
    where: { packageId: graduationBundleId, customerId: ahmad.userId },
  });

  if (!existingPkgBookD) {
    const subtotalD = 1440 + 425;
    const pkgBookD = await prisma.packageBooking.create({
      data: {
        packageId:             graduationBundleId,
        customerId:            ahmad.userId,
        guestCount:            40,
        status:                PackageBookingStatus.PENDING_PAYMENT,
        hallPrice:             0,
        optionalServicesTotal: 0,
        subtotal:              subtotalD,
        totalAmount:           subtotalD,
        selectedItems: {
          create: [
            { serviceId: foodHadidi.id, wasRequired: true, priceAtBooking: 1440 },
            { serviceId: decPetals.id,  wasRequired: true, priceAtBooking: 425  },
          ],
        },
      },
    });
    console.log('  ✅ PackageBooking D (PENDING_PAYMENT):', pkgBookD.id);
  } else {
    console.log('  ⚠️  PackageBooking D exists, skipping.');
  }

  console.log('\n✅ All packages and package bookings seeded.');

  return {
    royalWeddingPackageId,
    graduationBundleId,
    confirmedPkgBookingId,
    inProgressPkgBookingId,
    cancelledPkgBookingId,
  };
}
