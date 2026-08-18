// src/database/seeds/discounts.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds Discounts covering all combinations:
//
//  Scope × Origin × Status:
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │ Discount │ Scope   │ Origin           │ Status   │ Target           │
//  ├──────────────────────────────────────────────────────────────────────┤
//  │ D1       │ SERVICE │ PROVIDER         │ ACTIVE   │ HALL (Khalid)    │
//  │ D2       │ SERVICE │ COMPANY_FUNDED   │ ACTIVE   │ FOOD (Nabaah)    │
//  │ D3       │ SERVICE │ PROVIDER         │ EXPIRED  │ PHOTOGRAPHY      │
//  │ D4       │ SERVICE │ COMPANY_FUNDED   │ CANCELLED│ DECORATION       │
//  │ D5       │ PACKAGE │ PROVIDER         │ ACTIVE   │ Royal Wedding Pkg│
//  │ D6       │ PACKAGE │ COMPANY_FUNDED   │ ACTIVE   │ Graduation Bundle│
//  │ D7       │ SERVICE │ PROVIDER         │ ACTIVE   │ FOOD (Hadidi)    │
//  └──────────────────────────────────────────────────────────────────────┘
//
// Idempotency: discounts are unique by code (for coded ones) or by
// scope + serviceId/packageId + origin before creation.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DiscountOrigin,
  DiscountScope,
  DiscountStatus,
  PrismaClient,
} from '@prisma/client';
import { SeededPackagesContext } from './packages.seed';

// ─── Exported context ─────────────────────────────────────────────────────────

export interface SeededDiscountsContext {
  serviceDiscountActiveId: string;     // D1: HALL – PROVIDER – ACTIVE
  companyFoodDiscountId: string;       // D2: FOOD Nabaah – COMPANY_FUNDED – ACTIVE
  packageDiscountRoyalId: string;      // D5: Royal Wedding Package – PROVIDER – ACTIVE
  packageDiscountGradId: string;       // D6: Graduation Bundle – COMPANY_FUNDED – ACTIVE
}

// ─── Helper ───────────────────────────────────────────────────────────────────

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
  if (!provider) throw new Error(`Provider not found: ${providerEmail}`);
  const st = await prisma.serviceType.findUnique({ where: { name: typeName } });
  if (!st) throw new Error(`ServiceType not found: ${typeName}`);
  const service = await prisma.service.findFirst({
    where: { providerId: provider.id, serviceTypeId: st.id },
  });
  if (!service)
    throw new Error(`Service [${typeName}] not found for: ${providerEmail}`);
  return { provider, service };
}

async function findOrCreateDiscount(
  prisma: PrismaClient,
  lookupKey: { code?: string; serviceId?: string; packageId?: string; origin: DiscountOrigin },
  data: Parameters<PrismaClient['discount']['create']>[0]['data'],
): Promise<string> {
  let existing = null;

  if (lookupKey.code) {
    existing = await prisma.discount.findUnique({ where: { code: lookupKey.code } });
  } else if (lookupKey.serviceId) {
    existing = await prisma.discount.findFirst({
      where: {
        serviceId: lookupKey.serviceId,
        origin: lookupKey.origin,
        scope: DiscountScope.SERVICE,
      },
    });
  } else if (lookupKey.packageId) {
    existing = await prisma.discount.findFirst({
      where: {
        packageId: lookupKey.packageId,
        origin: lookupKey.origin,
        scope: DiscountScope.PACKAGE,
      },
    });
  }

  if (existing) {
    console.log('  ⚠️  Discount exists, skipping:', existing.code ?? existing.id);
    return existing.id;
  }

  const created = await prisma.discount.create({ data });
  console.log(
    `  ✅ Discount created [${created.scope}/${created.origin}/${created.status}]:`,
    created.code ?? created.id,
  );
  return created.id;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export async function seedDiscounts(
  prisma: PrismaClient,
  packages: SeededPackagesContext,
): Promise<SeededDiscountsContext> {
  console.log('\n  🏷️  Seeding Discounts…');

  // Resolve admin user for createdByUserId
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@eventy.com' },
  });
  if (!adminUser) throw new Error('Admin user not found. Run admin seed first.');

  // Resolve services
  const { provider: khalidProv, service: hallSvc }   = await resolveService(prisma, 'khalid@eventy.com',  'HALL');
  const { service: foodNabaahSvc }                   = await resolveService(prisma, 'anas@eventy.com',        'FOOD');
  const { service: photoSvc }                        = await resolveService(prisma, 'lina@eventy.com',      'PHOTOGRAPHY');
  const { provider: tarekProv, service: decGrandeSvc } = await resolveService(prisma, 'tarek@eventy.com',   'DECORATION');
  const { service: foodHadidiSvc }                   = await resolveService(prisma, 'sara@eventy.com', 'FOOD');

  // ── D1: SERVICE / PROVIDER / ACTIVE ──────────────────────────────────────
  // 15% off the Royal Events HALL service — provider-funded, valid summer 2026
  const serviceDiscountActiveId = await findOrCreateDiscount(
    prisma,
    { code: 'ROYAL-HALL15', origin: DiscountOrigin.PROVIDER },
    {
      scope:           DiscountScope.SERVICE,
      serviceId:       hallSvc.id,
      origin:          DiscountOrigin.PROVIDER,
      //code:            'ROYAL-HALL15',
      percentOff:      15,
      status:          DiscountStatus.ACTIVE,
      needsReconfirmation: false,
      startsAt:        new Date('2026-07-01'),
      endsAt:          new Date('2026-09-30'),
      createdByUserId: khalidProv.userId,
    },
  );

  // ── D2: SERVICE / COMPANY_FUNDED / ACTIVE ────────────────────────────────
  // 20% company-funded discount on Nabaah food service
  const companyFoodDiscountId = await findOrCreateDiscount(
    prisma,
    { code: 'EVENTY-FOOD20', origin: DiscountOrigin.COMPANY_FUNDED },
    {
      scope:           DiscountScope.SERVICE,
      serviceId:       foodNabaahSvc.id,
      origin:          DiscountOrigin.COMPANY_FUNDED,
      //code:            'EVENTY-FOOD20',
      percentOff:      20,
      status:          DiscountStatus.ACTIVE,
      needsReconfirmation: false,
      startsAt:        new Date('2026-06-01'),
      endsAt:          new Date('2026-12-31'),
      createdByUserId: adminUser.id,
    },
  );

  // ── D3: SERVICE / PROVIDER / EXPIRED ─────────────────────────────────────
  // Old 10% photography discount that has already expired
  await findOrCreateDiscount(
    prisma,
    { code: 'LENS10-SUMMER', origin: DiscountOrigin.PROVIDER },
    {
      scope:           DiscountScope.SERVICE,
      serviceId:       photoSvc.id,
      origin:          DiscountOrigin.PROVIDER,
      //code:            'LENS10-SUMMER',
      percentOff:      10,
      status:          DiscountStatus.EXPIRED,
      needsReconfirmation: false,
      startsAt:        new Date('2026-04-01'),
      endsAt:          new Date('2026-06-30'),
      createdByUserId: (await prisma.user.findUnique({ where: { email: 'lina@eventy.com' } }))!.id,
    },
  );

  // ── D4: SERVICE / COMPANY_FUNDED / CANCELLED ─────────────────────────────
  // Platform-wide decoration discount that was cancelled mid-campaign
  await findOrCreateDiscount(
    prisma,
    { code: 'EVENTY-DEC25', origin: DiscountOrigin.COMPANY_FUNDED },
    {
      scope:           DiscountScope.SERVICE,
      serviceId:       decGrandeSvc.id,
      origin:          DiscountOrigin.COMPANY_FUNDED,
      //code:            'EVENTY-DEC25',
      percentOff:      25,
      status:          DiscountStatus.CANCELLED,
      needsReconfirmation: true,
      startsAt:        new Date('2026-05-01'),
      endsAt:          new Date('2026-07-31'),
      createdByUserId: adminUser.id,
    },
  );

  // ── D5: PACKAGE / PROVIDER / ACTIVE ──────────────────────────────────────
  // 10% off the Royal Wedding Package — provider-funded
  const packageDiscountRoyalId = await findOrCreateDiscount(
    prisma,
    { packageId: packages.royalWeddingPackageId, origin: DiscountOrigin.PROVIDER },
    {
      scope:           DiscountScope.PACKAGE,
      packageId:       packages.royalWeddingPackageId,
      origin:          DiscountOrigin.PROVIDER,
      //code:            'ROYAL-PKG10',
      percentOff:      10,
      status:          DiscountStatus.ACTIVE,
      needsReconfirmation: false,
      startsAt:        new Date('2026-06-01'),
      endsAt:          new Date('2026-12-31'),
      createdByUserId: khalidProv.userId,
    },
  );

  // ── D6: PACKAGE / COMPANY_FUNDED / ACTIVE ────────────────────────────────
  // 12% company-funded discount on Graduation Bundle for the graduation season
  const packageDiscountGradId = await findOrCreateDiscount(
    prisma,
    { packageId: packages.graduationBundleId, origin: DiscountOrigin.COMPANY_FUNDED },
    {
      scope:           DiscountScope.PACKAGE,
      packageId:       packages.graduationBundleId,
      origin:          DiscountOrigin.COMPANY_FUNDED,
      //code:            'EVENTY-GRAD12',
      percentOff:      12,
      status:          DiscountStatus.ACTIVE,
      needsReconfirmation: false,
      startsAt:        new Date('2026-09-01'),
      endsAt:          new Date('2027-01-31'),
      createdByUserId: adminUser.id,
    },
  );

  // ── D7: SERVICE / PROVIDER / ACTIVE (no code) ────────────────────────────
  // 8% unlisted provider-funded discount on Hadidi food (no promo code)
  await findOrCreateDiscount(
    prisma,
    { serviceId: foodHadidiSvc.id, origin: DiscountOrigin.PROVIDER },
    {
      scope:           DiscountScope.SERVICE,
      serviceId:       foodHadidiSvc.id,
      origin:          DiscountOrigin.PROVIDER,
      percentOff:      8,
      status:          DiscountStatus.ACTIVE,
      needsReconfirmation: false,
      createdByUserId: (await prisma.user.findUnique({ where: { email: 'sara@eventy.com' } }))!.id,
    },
  );

  console.log('\n✅ All discounts seeded.');

  return {
    serviceDiscountActiveId,
    companyFoodDiscountId,
    packageDiscountRoyalId,
    packageDiscountGradId,
  };
}
