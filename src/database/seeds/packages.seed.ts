// src/database/seeds/packages.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds Packages with their items and PackageEventBookings, covering all scenarios:
//
//  Package 1 – "Royal Wedding Package"  → ACTIVE
//    • PackageEventBooking A → CONFIRMED   (Ahmad)
//    • PackageEventBooking B → CANCELLED   (Dina)
//
//  Package 2 – "Graduation Bundle"      → ACTIVE
//    • PackageEventBooking C → IN_PROGRESS  (Dina)
//    • PackageEventBooking D → PENDING_PAYMENT (Ahmad)
//
//  Package 3 – "Birthday Starter Pack"  → DRAFT (no bookings)
//  Package 4 – "Engagement Elegance"    → CANCELLED (no bookings)
//
// Idempotency: each record is looked up by name / customer + package before
// being created.
// ─────────────────────────────────────────────────────────────────────────────

import {
  PackageEventBookingStatus,
  PackageStatus,
  PackageServiceStatus,
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
  // PACKAGE 1: Royal Wedding Package — ACTIVE
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
        discountPercentage: 10,
        services: {
          create: [
            { providerId: khalidProv.id, serviceId: hallSvc.id,    status: PackageServiceStatus.ACTIVE },
            { providerId: anasProv.id,   serviceId: foodNabaah.id, status: PackageServiceStatus.ACTIVE },
            { providerId: tarekProv.id,  serviceId: decGrande.id,  status: PackageServiceStatus.ACTIVE },
            { providerId: linaProv.id,   serviceId: photoLens.id,  status: PackageServiceStatus.ACTIVE },
          ],
        },
      },
    });
    royalWeddingPackageId = pkg1.id;
    console.log('  ✅ Package 1 created:', pkg1.name, '|', pkg1.id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 2: Graduation Bundle — ACTIVE
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
        discountPercentage: 15,
        services: {
          create: [
            { providerId: saraProv.id, serviceId: foodHadidi.id, status: PackageServiceStatus.ACTIVE },
            { providerId: mayaProv.id, serviceId: decPetals.id,  status: PackageServiceStatus.ACTIVE },
            { providerId: farisProv.id, serviceId: soundBeat.id, status: PackageServiceStatus.ACTIVE },
            { providerId: nourProv.id, serviceId: favorsGift.id, status: PackageServiceStatus.ACTIVE },
          ],
        },
      },
    });
    graduationBundleId = pkg2.id;
    console.log('  ✅ Package 2 created:', pkg2.name, '|', pkg2.id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 3: Birthday Starter Pack — DRAFT
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
        status: PackageStatus.DRAFT,
        services: {
          create: [
            { providerId: anasProv.id, serviceId: foodNabaah.id, status: PackageServiceStatus.ACTIVE },
            { providerId: linaProv.id, serviceId: photoLens.id,  status: PackageServiceStatus.PENDING_PROVIDER_APPROVAL },
          ],
        },
      },
    });
    console.log('  ✅ Package 3 created (DRAFT):', pkg3.name);
  } else {
    console.log('  ⚠️  Package 3 exists, skipping:', existingPkg3.name);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 4: Engagement Elegance — CANCELLED
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
        status: PackageStatus.CANCELLED,
        services: {
          create: [
            { providerId: tarekProv.id, serviceId: decGrande.id, status: PackageServiceStatus.ACTIVE },
            { providerId: farisProv.id, serviceId: soundBeat.id, status: PackageServiceStatus.REJECTED },
          ],
        },
      },
    });
    console.log('  ✅ Package 4 created (CANCELLED):', pkg4.name);
  } else {
    console.log('  ⚠️  Package 4 exists, skipping:', existingPkg4.name);
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
  const existingPkgBookA = await prisma.packageEventBooking.findFirst({
    where: { packageId: royalWeddingPackageId, customerId: ahmad.userId },
  });

  if (existingPkgBookA) {
    confirmedPkgBookingId = existingPkgBookA.id;
    console.log('  ⚠️  PackageEventBooking A exists, skipping.');
  } else {
    const pkgBookA = await prisma.packageEventBooking.create({
      data: {
        packageId:             royalWeddingPackageId,
        customerId:            ahmad.userId,
        eventId:               ahmadWeddingEvent?.id ?? undefined,
        status:                PackageEventBookingStatus.CONFIRMED,
        totalAmount:           3910,
      },
    });
    confirmedPkgBookingId = pkgBookA.id;
    console.log('  ✅ PackageEventBooking A (CONFIRMED):', pkgBookA.id);
  }

  // ── Booking B: Dina → Royal Wedding Package (CANCELLED) ──────────────────
  let cancelledPkgBookingId = '';
  const existingPkgBookB = await prisma.packageEventBooking.findFirst({
    where: { packageId: royalWeddingPackageId, customerId: dina.userId },
  });

  if (existingPkgBookB) {
    cancelledPkgBookingId = existingPkgBookB.id;
    console.log('  ⚠️  PackageEventBooking B exists, skipping.');
  } else {
    const pkgBookB = await prisma.packageEventBooking.create({
      data: {
        packageId:             royalWeddingPackageId,
        customerId:            dina.userId,
        status:                PackageEventBookingStatus.CANCELLED,
        totalAmount:           3100,
      },
    });
    cancelledPkgBookingId = pkgBookB.id;
    console.log('  ✅ PackageEventBooking B (CANCELLED):', pkgBookB.id);
  }

  // ── Booking C: Dina → Graduation Bundle (IN_PROGRESS) ────────────────────
  let inProgressPkgBookingId = '';
  const existingPkgBookC = await prisma.packageEventBooking.findFirst({
    where: { packageId: graduationBundleId, customerId: dina.userId },
  });

  if (existingPkgBookC) {
    inProgressPkgBookingId = existingPkgBookC.id;
    console.log('  ⚠️  PackageEventBooking C exists, skipping.');
  } else {
    const pkgBookC = await prisma.packageEventBooking.create({
      data: {
        packageId:             graduationBundleId,
        customerId:            dina.userId,
        eventId:               dinaGradEvent?.id ?? undefined,
        status:                PackageEventBookingStatus.IN_PROGRESS,
        totalAmount:           4835,
      },
    });
    inProgressPkgBookingId = pkgBookC.id;
    console.log('  ✅ PackageEventBooking C (IN_PROGRESS):', pkgBookC.id);
  }

  // ── Booking D: Ahmad → Graduation Bundle (PENDING_PAYMENT) ───────────────
  const existingPkgBookD = await prisma.packageEventBooking.findFirst({
    where: { packageId: graduationBundleId, customerId: ahmad.userId },
  });

  if (!existingPkgBookD) {
    const pkgBookD = await prisma.packageEventBooking.create({
      data: {
        packageId:             graduationBundleId,
        customerId:            ahmad.userId,
        status:                PackageEventBookingStatus.PENDING_PAYMENT,
        totalAmount:           1865,
      },
    });
    console.log('  ✅ PackageEventBooking D (PENDING_PAYMENT):', pkgBookD.id);
  } else {
    console.log('  ⚠️  PackageEventBooking D exists, skipping.');
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
