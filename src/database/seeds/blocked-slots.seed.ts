// src/database/seeds/blocked-slots.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds BlockedSlot records so providers appear as unavailable on specific
// dates in the calendar — important for testing booking conflict logic.
//
// Idempotent: blocks are deduplicated by (serviceId + date + fromTime).
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

interface BlockedSlotDef {
  providerEmail: string;
  serviceTypeName: string;
  date: Date;
  fromTime?: string;
  toTime?: string;
  reason: string;
}

const BLOCKED_SLOTS: BlockedSlotDef[] = [
  // Royal Events Venue: fully blocked for a private corporate gala
  {
    providerEmail: 'khalid@eventy.com',
    serviceTypeName: 'HALL',
    date: new Date('2026-08-20'),
    reason: 'Private corporate gala — venue fully reserved.',
  },
  // Royal Events Venue: morning blocked, afternoon free
  {
    providerEmail: 'khalid@eventy.com',
    serviceTypeName: 'HALL',
    date: new Date('2026-09-01'),
    fromTime: '10:00',
    toTime: '16:00',
    reason: 'Hall setup and rehearsal for a confirmed wedding.',
  },
  // LensCraft Studio: blocked for a full-day shoot
  {
    providerEmail: 'lina@eventy.com',
    serviceTypeName: 'PHOTOGRAPHY',
    date: new Date('2026-09-15'),
    reason: 'Full-day wedding shoot already confirmed — not available.',
  },
  // NABAAH Catering: blocked for Eid holiday
  {
    providerEmail: 'anas@eventy.com',
    serviceTypeName: 'FOOD',
    date: new Date('2026-06-27'),
    reason: 'Eid holiday — kitchen closed.',
  },
  // Grande Décor: blocked for setup of a confirmed event
  {
    providerEmail: 'tarek@eventy.com',
    serviceTypeName: 'DECORATION',
    date: new Date('2026-10-09'),
    fromTime: '08:00',
    toTime: '14:00',
    reason: 'Setup day for a confirmed engagement event.',
  },
  // SoundWave: blocked for equipment maintenance
  {
    providerEmail: 'yousef@eventy.com',
    serviceTypeName: 'SOUND',
    date: new Date('2026-07-15'),
    reason: 'Annual equipment maintenance day.',
  },
];

export async function seedBlockedSlots(prisma: PrismaClient): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const def of BLOCKED_SLOTS) {
    // Resolve user → provider
    const user = await prisma.user.findUnique({ where: { email: def.providerEmail } });
    if (!user) {
      console.warn(`  ⚠️  Provider user not found: ${def.providerEmail}`);
      continue;
    }

    const provider = await prisma.serviceProvider.findUnique({ where: { userId: user.id } });
    if (!provider) {
      console.warn(`  ⚠️  ServiceProvider not found for: ${def.providerEmail}`);
      continue;
    }

    const serviceType = await prisma.serviceType.findUnique({ where: { name: def.serviceTypeName } });
    if (!serviceType) {
      console.warn(`  ⚠️  ServiceType not found: ${def.serviceTypeName}`);
      continue;
    }

    const service = await prisma.service.findFirst({
      where: { providerId: provider.id, serviceTypeId: serviceType.id },
    });
    if (!service) {
      console.warn(`  ⚠️  Service not found for ${def.providerEmail} / ${def.serviceTypeName}`);
      continue;
    }

    // Idempotency check
    const existing = await prisma.blockedSlot.findFirst({
      where: {
        serviceId: service.id,
        date: def.date,
        fromTime: def.fromTime ?? null,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.blockedSlot.create({
      data: {
        serviceId: service.id,
        providerId: provider.id,
        date: def.date,
        fromTime: def.fromTime,
        toTime: def.toTime,
        reason: def.reason,
      },
    });
    created++;
  }

  console.log(`✅ BlockedSlots: ${created} created, ${skipped} skipped.`);
}
