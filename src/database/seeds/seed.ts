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
//   7. Packages + PackageBookings    (depends on Providers, Services, Customers, Events)
//   8. Discounts                     (depends on Services, Packages)
//   9. Payments                      (depends on Bookings, Discounts)
//  10. Favorites                     (depends on Customers, Services, Providers, Packages)
//  11. Reviews                       (depends on Bookings, Customers)
//  12. Complaints                    (depends on Customers, Bookings, PackageBookings)
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

import { seedAdmin }        from './admin.seed';
import { seedProviders }    from './providers.seed';
import { seedCustomers }    from './customers.seed';
import { seedEvents }       from './events.seed';
import { seedNotifications } from './notifications.seed';
import { seedBlockedSlots } from './blocked-slots.seed';
import { seedPackages }     from './packages.seed';
import { seedDiscounts }    from './discounts.seed';
import { seedPayments }     from './payments.seed';
import { seedFavorites }    from './favorites.seed';
import { seedReviews }      from './reviews.seed';
import { seedComplaints }   from './complaints.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('         🌱  Eventy Database Seeder       ');
  console.log('══════════════════════════════════════════\n');

  // ── Step 1: Admin + ServiceTypes ────────────────────────────────────────────
  console.log('── [1/12] Seeding Admin & ServiceTypes ──');
  await seedAdmin(prisma);

  // ── Step 2: Providers + Services ────────────────────────────────────────────
  console.log('\n── [2/12] Seeding Providers & Services ──');
  const providers = await seedProviders(prisma);

  // ── Step 3: Customers ────────────────────────────────────────────────────────
  console.log('\n── [3/12] Seeding Customers ──');
  const customers = await seedCustomers(prisma);

  // ── Step 4: Events + Bookings ────────────────────────────────────────────────
  console.log('\n── [4/12] Seeding Events & Bookings ──');
  const events = await seedEvents(prisma, customers);

  // ── Step 5: Notifications ────────────────────────────────────────────────────
  console.log('\n── [5/12] Seeding Notifications ──');
  await seedNotifications(prisma, { events, providers });

  // ── Step 6: Blocked Slots ────────────────────────────────────────────────────
  console.log('\n── [6/12] Seeding Blocked Slots ──');
  await seedBlockedSlots(prisma);

  // ── Step 7: Packages + Package Bookings ─────────────────────────────────────
  console.log('\n── [7/12] Seeding Packages & Package Bookings ──');
  const packages = await seedPackages(prisma, customers);

  // ── Step 8: Discounts ────────────────────────────────────────────────────────
  console.log('\n── [8/12] Seeding Discounts ──');
  const discounts = await seedDiscounts(prisma, packages);

  // ── Step 9: Payments ─────────────────────────────────────────────────────────
  console.log('\n── [9/12] Seeding Payments ──');
  await seedPayments(prisma, events, discounts);

  // ── Step 10: Favorites ───────────────────────────────────────────────────────
  console.log('\n── [10/12] Seeding Favorites ──');
  await seedFavorites(prisma, customers, packages);

  // ── Step 11: Reviews ─────────────────────────────────────────────────────────
  console.log('\n── [11/12] Seeding Reviews & Ratings ──');
  await seedReviews(prisma, events, customers);

  // ── Step 12: Complaints ──────────────────────────────────────────────────────
  console.log('\n── [12/12] Seeding Complaints ──');
  await seedComplaints(prisma, customers, events, packages);

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