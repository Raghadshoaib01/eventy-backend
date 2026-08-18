// src/database/seeds/favorites.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds Favorite records covering all FavoriteTargetType values:
//
//  Ahmad:
//    • Favorites 3 services (HALL, FOOD, PHOTOGRAPHY)
//    • Favorites 2 providers
//    • Favorites 1 package (Royal Wedding Package)
//
//  Dina:
//    • Favorites 2 services (DECORATION, FOOD)
//    • Favorites 1 provider
//    • Favorites 2 packages (Royal Wedding Package, Graduation Bundle)
//
// Idempotency: (userId, targetType, targetId) has a unique constraint in the
// schema, so we skip on conflict.
// ─────────────────────────────────────────────────────────────────────────────

import { FavoriteTargetType, PrismaClient } from '@prisma/client';
import { SeededCustomer } from './customers.seed';
import { SeededPackagesContext } from './packages.seed';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function addFavorite(
  prisma: PrismaClient,
  userId: string,
  targetType: FavoriteTargetType,
  targetId: string,
): Promise<void> {
  const existing = await prisma.favorite.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
  });
  if (existing) {
    console.log(`  ⚠️  Favorite [${targetType}] exists for user, skipping.`);
    return;
  }
  await prisma.favorite.create({ data: { userId, targetType, targetId } });
  console.log(`  ✅ Favorite [${targetType}]: ${targetId}`);
}

async function resolveService(
  prisma: PrismaClient,
  providerEmail: string,
  typeName: string,
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: providerEmail } });
  if (!user) throw new Error(`Provider user not found: ${providerEmail}`);
  const prov = await prisma.serviceProvider.findUnique({ where: { userId: user.id } });
  if (!prov) throw new Error(`Provider not found: ${providerEmail}`);
  const st = await prisma.serviceType.findUnique({ where: { name: typeName } });
  if (!st) throw new Error(`ServiceType not found: ${typeName}`);
  const svc = await prisma.service.findFirst({
    where: { providerId: prov.id, serviceTypeId: st.id },
  });
  if (!svc)
    throw new Error(`Service [${typeName}] not found for: ${providerEmail}`);
  return svc.id;
}

async function resolveProvider(prisma: PrismaClient, email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Provider user not found: ${email}`);
  const prov = await prisma.serviceProvider.findUnique({ where: { userId: user.id } });
  if (!prov) throw new Error(`Provider not found: ${email}`);
  return prov.id;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export async function seedFavorites(
  prisma: PrismaClient,
  customers: SeededCustomer[],
  packages: SeededPackagesContext,
): Promise<void> {
  console.log('\n  ❤️  Seeding Favorites…');

  const ahmad = customers.find((c) => c.email === 'ahmad@eventy.com');
  const dina  = customers.find((c) => c.email === 'dina@eventy.com');
  if (!ahmad || !dina)
    throw new Error('Expected customers not found. Run customer seed first.');

  // ── Resolve service IDs ──────────────────────────────────────────────────
  const hallSvcId      = await resolveService(prisma, 'khalid@eventy.com',   'HALL');
  const foodNabaahId   = await resolveService(prisma, 'anas@eventy.com',          'FOOD');
  const photoLensId    = await resolveService(prisma, 'lina@eventy.com',        'PHOTOGRAPHY');
  const decGrandeId    = await resolveService(prisma, 'tarek@eventy.com',       'DECORATION');
  const foodHadidiId   = await resolveService(prisma, 'sara@eventy.com',  'FOOD');
  const soundBeatId    = await resolveService(prisma, 'faris@eventy.com',      'SOUND');

  // ── Resolve provider IDs ─────────────────────────────────────────────────
  const khalidProvId   = await resolveProvider(prisma, 'khalid@eventy.com');
  const anasPrvId      = await resolveProvider(prisma, 'anas@eventy.com');
  const linaPrvId      = await resolveProvider(prisma, 'lina@eventy.com');
  const tarekPrvId     = await resolveProvider(prisma, 'tarek@eventy.com');

  // ══════════════════════════════════════════════════════════════════════════
  // Ahmad's favorites
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n  [Ahmad]');

  // Services
  await addFavorite(prisma, ahmad.userId, FavoriteTargetType.SERVICE,  hallSvcId);
  await addFavorite(prisma, ahmad.userId, FavoriteTargetType.SERVICE,  foodNabaahId);
  await addFavorite(prisma, ahmad.userId, FavoriteTargetType.SERVICE,  photoLensId);

  // Providers
  await addFavorite(prisma, ahmad.userId, FavoriteTargetType.PROVIDER, khalidProvId);
  await addFavorite(prisma, ahmad.userId, FavoriteTargetType.PROVIDER, anasPrvId);

  // Package
  await addFavorite(prisma, ahmad.userId, FavoriteTargetType.PACKAGE,  packages.royalWeddingPackageId);

  // ══════════════════════════════════════════════════════════════════════════
  // Dina's favorites
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n  [Dina]');

  // Services
  await addFavorite(prisma, dina.userId, FavoriteTargetType.SERVICE,  decGrandeId);
  await addFavorite(prisma, dina.userId, FavoriteTargetType.SERVICE,  foodHadidiId);
  await addFavorite(prisma, dina.userId, FavoriteTargetType.SERVICE,  soundBeatId);

  // Provider
  await addFavorite(prisma, dina.userId, FavoriteTargetType.PROVIDER, tarekPrvId);
  await addFavorite(prisma, dina.userId, FavoriteTargetType.PROVIDER, linaPrvId);

  // Packages
  await addFavorite(prisma, dina.userId, FavoriteTargetType.PACKAGE,  packages.royalWeddingPackageId);
  await addFavorite(prisma, dina.userId, FavoriteTargetType.PACKAGE,  packages.graduationBundleId);

  console.log('\n✅ All favorites seeded.');
}
