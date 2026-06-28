// src/database/seeds/seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Main seed entry point.
//
// Execution order (bottom-up dependency graph):
//   1. Admin + ServiceTypes          (no dependencies)
//   2. Providers + Services          (depends on ServiceTypes)
//   3. Customers                     (no dependencies)
//   4. Events + Bookings             (depends on Providers, Services, Customers)
//   5. Notifications                 (depends on Users)
//   6. BlockedSlots                  (depends on Providers, Services)
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

import { seedAdmin }        from './admin.seed';
import { seedProviders }    from './providers.seed';
import { seedCustomers }    from './customers.seed';
import { seedEvents }       from './events.seed';
import { seedNotifications } from './notifications.seed';
import { seedBlockedSlots } from './blocked-slots.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('         🌱  Eventy Database Seeder       ');
  console.log('══════════════════════════════════════════\n');

  // ── Step 1: Admin + ServiceTypes ────────────────────────────────────────────
  console.log('── [1/6] Seeding Admin & ServiceTypes ──');
  await seedAdmin(prisma);

  // ── Step 2: Providers + Services ────────────────────────────────────────────
  console.log('\n── [2/6] Seeding Providers & Services ──');
  await seedProviders(prisma);

  // ── Step 3: Customers ────────────────────────────────────────────────────────
  console.log('\n── [3/6] Seeding Customers ──');
  const customers = await seedCustomers(prisma);

  // ── Step 4: Events + Bookings ────────────────────────────────────────────────
  console.log('\n── [4/6] Seeding Events & Bookings ──');
  await seedEvents(prisma, customers);

  // ── Step 5: Notifications ────────────────────────────────────────────────────
  console.log('\n── [5/6] Seeding Notifications ──');
  await seedNotifications(prisma);

  // ── Step 6: Blocked Slots ────────────────────────────────────────────────────
  console.log('\n── [6/6] Seeding Blocked Slots ──');
  await seedBlockedSlots(prisma);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('  🎉  All seeds completed successfully!   ');
  console.log('══════════════════════════════════════════\n');
  console.log('  Shared password for all seeded accounts (except Admin):');
  console.log('  🔑  Eventy@123456\n');
  console.log('  Admin credentials:');
  console.log('  📧  admin@eventy.com');
  console.log('  🔑  Admin@123456\n');
  console.log('  Test customer accounts:');
  console.log('  📧  ahmad@customer.eventy.com  /  dina@customer.eventy.com');
  console.log('══════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });