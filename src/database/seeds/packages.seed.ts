// src/database/seeds/packages.seed.ts
import { PackageEventBookingStatus, PackageStatus, PackageServiceStatus, PrismaClient } from '@prisma/client';
import { SeededCustomer } from './customers.seed';

export interface SeededPackagesContext {
  royalWeddingPackageId: string;   // Emerald Signature Package (hazem) — ACTIVE
  graduationBundleId: string;      // Diamond Signature Package (rasha) — ACTIVE
  confirmedPkgBookingId: string;   // Ahmad → Emerald Signature (IN_PROGRESS)
  inProgressPkgBookingId: string;  // Dina  → Diamond Signature (IN_PROGRESS)
  cancelledPkgBookingId: string;   // Dina  → Emerald Signature (CANCELLED)
}

async function resolveProvider(prisma: PrismaClient, email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Provider user not found: ${email}`);
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: user.id } });
  if (!provider) throw new Error(`ServiceProvider not found for: ${email}`);
  return provider;
}

async function resolveService(prisma: PrismaClient, providerId: string, typeName: string) {
  const serviceType = await prisma.serviceType.findUnique({ where: { name: typeName } });
  if (!serviceType) throw new Error(`ServiceType not found: ${typeName}`);
  const service = await prisma.service.findFirst({ where: { providerId, serviceTypeId: serviceType.id } });
  if (!service) throw new Error(`Service [${typeName}] not found for provider: ${providerId}`);
  return service;
}

async function createPackageWithServices(
  prisma: PrismaClient,
  ownerProviderId: string,
  name: string,
  description: string,
  status: PackageStatus,
  discountPercentage: number,
  serviceRows: { providerId: string; serviceId: string; status: PackageServiceStatus }[],
) {
  const existing = await prisma.package.findFirst({ where: { providerId: ownerProviderId, name } });
  if (existing) {
    console.log('  ⚠️  Package exists, skipping:', existing.name);
    return existing.id;
  }

  const pkg = await prisma.package.create({
    data: {
      providerId: ownerProviderId,
      name,
      description,
      status,
      discountPercentage,
      services: { create: serviceRows },
    },
  });
  console.log(`  ✅ Package created [${status}]:`, pkg.name, '|', pkg.id);
  return pkg.id;
}

async function createPackageBooking(
  prisma: PrismaClient,
  data: {
    packageId: string;
    customerId: string;
    eventId?: string;
    status: PackageEventBookingStatus;
    totalAmount: number;
  },
): Promise<string> {
  const existing = await prisma.packageEventBooking.findFirst({
    where: { packageId: data.packageId, customerId: data.customerId, status: data.status },
  });
  if (existing) {
    console.log('  ⚠️  PackageEventBooking exists, skipping.');
    return existing.id;
  }
  const pb = await prisma.packageEventBooking.create({
    data: {
      packageId: data.packageId,
      customerId: data.customerId,
      eventId: data.eventId,
      status: data.status,
      totalAmount: data.totalAmount,
    },
  });
  console.log(`  ✅ PackageEventBooking [${data.status}]:`, pb.id);
  return pb.id;
}

export async function seedPackages(
  prisma: PrismaClient,
  customers: SeededCustomer[],
): Promise<SeededPackagesContext> {
  console.log('\n  📦 Seeding Packages…');

  const ahmad = customers.find((c) => c.email === 'ahmad@eventy.com');
  const dina = customers.find((c) => c.email === 'dina@eventy.com');
  if (!ahmad || !dina) throw new Error('Expected customers not found. Run customer seed first.');

  // ── ملّاك الصالات الحصرية ──
  const hazemProv = await resolveProvider(prisma, 'hazem@eventy.com');
  const rashaProv = await resolveProvider(prisma, 'rasha@eventy.com');
  const hazemHall = await resolveService(prisma, hazemProv.id, 'HALL');
  const rashaHall = await resolveService(prisma, rashaProv.id, 'HALL');

  // ── شركاء (خدمات فعّالة من الـ12 مزوّد الأساسي) ──
  const anasProv = await resolveProvider(prisma, 'anas@eventy.com');
  const linaProv = await resolveProvider(prisma, 'lina@eventy.com');
  const tarekProv = await resolveProvider(prisma, 'tarek@eventy.com');
  const saraProv = await resolveProvider(prisma, 'sara@eventy.com');
  const omarProv = await resolveProvider(prisma, 'omar@eventy.com');
  const yousefProv = await resolveProvider(prisma, 'yousef@eventy.com');
  const nourProv = await resolveProvider(prisma, 'nour@eventy.com');
  const mayaProv = await resolveProvider(prisma, 'maya@eventy.com');
  const farisProv = await resolveProvider(prisma, 'faris@eventy.com');

  const anasFood = await resolveService(prisma, anasProv.id, 'FOOD');
  const linaPhoto = await resolveService(prisma, linaProv.id, 'PHOTOGRAPHY');
  const tarekDecor = await resolveService(prisma, tarekProv.id, 'DECORATION');
  const saraFood = await resolveService(prisma, saraProv.id, 'FOOD');
  const omarPhoto = await resolveService(prisma, omarProv.id, 'PHOTOGRAPHY');
  const yousefSound = await resolveService(prisma, yousefProv.id, 'SOUND');
  const nourFavors = await resolveService(prisma, nourProv.id, 'FAVORS');
  const mayaDecor = await resolveService(prisma, mayaProv.id, 'DECORATION');
  const farisSound = await resolveService(prisma, farisProv.id, 'SOUND');

  // ════════════════════════════════════════════════════════════
  // HAZEM — 3 باقات
  // ════════════════════════════════════════════════════════════

  // 1) ACTIVE — hall + FOOD(anas) + PHOTOGRAPHY(lina), الكل ACTIVE
  const emeraldSignatureId = await createPackageWithServices(
    prisma, hazemProv.id, 'Emerald Signature Package',
    'Full wedding experience: Emerald Hall, premium catering, and photography.',
    PackageStatus.ACTIVE, 12,
    [
      { providerId: hazemProv.id, serviceId: hazemHall.id, status: PackageServiceStatus.ACTIVE },
      { providerId: anasProv.id, serviceId: anasFood.id, status: PackageServiceStatus.ACTIVE },
      { providerId: linaProv.id, serviceId: linaPhoto.id, status: PackageServiceStatus.ACTIVE },
    ],
  );

  // 2) CANCELLED — hall + DECORATION(tarek), الكل REJECTED بعد الإلغاء
  const emeraldBudgetId = await createPackageWithServices(
    prisma, hazemProv.id, 'Emerald Budget Package',
    'A budget-friendly hall + decoration bundle (cancelled by owner).',
    PackageStatus.CANCELLED, 5,
    [
      { providerId: hazemProv.id, serviceId: hazemHall.id, status: PackageServiceStatus.REJECTED },
      { providerId: tarekProv.id, serviceId: tarekDecor.id, status: PackageServiceStatus.REJECTED },
    ],
  );

  // 3) DRAFT — hall(ACTIVE) + FOOD(sara,ACTIVE مقبول) + PHOTOGRAPHY(omar,REJECTED مرفوض) + SOUND(yousef,PENDING بانتظار الرد)
  await createPackageWithServices(
    prisma, hazemProv.id, 'Emerald Draft Package',
    'Draft bundle still gathering partner responses.',
    PackageStatus.DRAFT, 10,
    [
      { providerId: hazemProv.id, serviceId: hazemHall.id, status: PackageServiceStatus.ACTIVE },
      { providerId: saraProv.id, serviceId: saraFood.id, status: PackageServiceStatus.ACTIVE },
      { providerId: omarProv.id, serviceId: omarPhoto.id, status: PackageServiceStatus.REJECTED },
      { providerId: yousefProv.id, serviceId: yousefSound.id, status: PackageServiceStatus.PENDING_PROVIDER_APPROVAL },
    ],
  );

  // ════════════════════════════════════════════════════════════
  // RASHA — 3 باقات
  // ════════════════════════════════════════════════════════════

  // 1) ACTIVE — hall + DECORATION(maya) + SOUND(faris)
  const diamondSignatureId = await createPackageWithServices(
    prisma, rashaProv.id, 'Diamond Signature Package',
    'Complete celebration bundle: Diamond Hall, decoration, and sound.',
    PackageStatus.ACTIVE, 15,
    [
      { providerId: rashaProv.id, serviceId: rashaHall.id, status: PackageServiceStatus.ACTIVE },
      { providerId: mayaProv.id, serviceId: mayaDecor.id, status: PackageServiceStatus.ACTIVE },
      { providerId: farisProv.id, serviceId: farisSound.id, status: PackageServiceStatus.ACTIVE },
    ],
  );

  // 2) CANCELLED — hall + FAVORS(nour)
  await createPackageWithServices(
    prisma, rashaProv.id, 'Diamond Simple Package',
    'A simple hall + favors bundle (cancelled by owner).',
    PackageStatus.CANCELLED, 5,
    [
      { providerId: rashaProv.id, serviceId: rashaHall.id, status: PackageServiceStatus.REJECTED },
      { providerId: nourProv.id, serviceId: nourFavors.id, status: PackageServiceStatus.REJECTED },
    ],
  );

  // 3) DRAFT — hall(ACTIVE) + FOOD(anas,ACTIVE) + DECORATION(tarek,REJECTED) + PHOTOGRAPHY(lina,PENDING)
  await createPackageWithServices(
    prisma, rashaProv.id, 'Diamond Draft Package',
    'Draft bundle still gathering partner responses.',
    PackageStatus.DRAFT, 8,
    [
      { providerId: rashaProv.id, serviceId: rashaHall.id, status: PackageServiceStatus.ACTIVE },
      { providerId: anasProv.id, serviceId: anasFood.id, status: PackageServiceStatus.ACTIVE },
      { providerId: tarekProv.id, serviceId: tarekDecor.id, status: PackageServiceStatus.REJECTED },
      { providerId: linaProv.id, serviceId: linaPhoto.id, status: PackageServiceStatus.PENDING_PROVIDER_APPROVAL },
    ],
  );

  // ════════════════════════════════════════════════════════════
  // حجوزات الباقات — تغطي الحالات المطلوبة (ثقل أكبر على أحمد)
  // ════════════════════════════════════════════════════════════

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const ahmadEvent = await prisma.event.findFirst({ where: { customerId: ahmad.userId, name: 'Al-Rashid Wedding' } });
  const dinaGradEvent = await prisma.event.findFirst({ where: { customerId: dina.userId, name: 'Dina Graduation Celebration' } });

  // Ahmad → Emerald Signature — IN_PROGRESS (مقبول + مدفوع، قيد العمل)
  const confirmedPkgBookingId = await createPackageBooking(prisma, {
    packageId: emeraldSignatureId,
    customerId: ahmad.userId,
    eventId: ahmadEvent?.id,
    status: PackageEventBookingStatus.IN_PROGRESS,
    totalAmount: 4200,
  });

  // Ahmad → Diamond Signature — PENDING_PAYMENT (مقبول، بانتظار الدفع)
  await createPackageBooking(prisma, {
    packageId: diamondSignatureId,
    customerId: ahmad.userId,
    status: PackageEventBookingStatus.PENDING_PAYMENT,
    totalAmount: 3600,
  });

  // Dina → Diamond Signature — IN_PROGRESS
  const inProgressPkgBookingId = await createPackageBooking(prisma, {
    packageId: diamondSignatureId,
    customerId: dina.userId,
    eventId: dinaGradEvent?.id,
    status: PackageEventBookingStatus.IN_PROGRESS,
    totalAmount: 3900,
  });

  // Dina → Emerald Signature — CANCELLED
  const cancelledPkgBookingId = await createPackageBooking(prisma, {
    packageId: emeraldSignatureId,
    customerId: dina.userId,
    status: PackageEventBookingStatus.CANCELLED,
    totalAmount: 3100,
  });

  // Dina → Diamond Signature (طلب ثانٍ) — PENDING (بالانتظار، لم يردّ عليه المزوّد بعد)
  await createPackageBooking(prisma, {
    packageId: diamondSignatureId,
    customerId: dina.userId,
    status: PackageEventBookingStatus.PENDING,
    totalAmount: 3900,
  });

  console.log('\n✅ All packages and package bookings seeded.');

  return {
    royalWeddingPackageId: emeraldSignatureId,
    graduationBundleId: diamondSignatureId,
    confirmedPkgBookingId,
    inProgressPkgBookingId,
    cancelledPkgBookingId,
  };
}