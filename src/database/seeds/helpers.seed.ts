// src/database/seeds/helpers.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities used across all seed files.
// ─────────────────────────────────────────────────────────────────────────────

import * as bcrypt from 'bcrypt';
import { DayOfWeek, PrismaClient } from '@prisma/client';

/** Single password used for every seeded account (admin excluded). */
export const SEED_PASSWORD = 'Eventy@123456';

/** Pre-hashed version – compute once, reuse everywhere. */
let _cachedHash: string | null = null;
export async function getSeedPasswordHash(): Promise<string> {
  if (!_cachedHash) {
    _cachedHash = await bcrypt.hash(SEED_PASSWORD, 12);
  }
  return _cachedHash;
}

// ─── Availability helpers ─────────────────────────────────────────────────────

export type WorkingDayInput = {
  dayOfWeek: DayOfWeek;
  serviceId: string;
};

export interface AvailabilityBlock {
  workFromTime: string;
  workToTime: string;
  capacity: number;
  hasSlots: boolean;
  days: DayOfWeek[];
  timeSlots?: { fromTime: string; toTime: string; capacity: number }[];
}

/**
 * Creates a ServiceAvailability record with its working days and optional
 * time slots for a given service.  Idempotent: checks for an existing
 * availability record that covers the same days before inserting.
 */
export async function createAvailability(
  prisma: PrismaClient,
  serviceId: string,
  block: AvailabilityBlock,
): Promise<void> {
  // Build a deterministic "signature" so we can skip re-creation.
  // We look for an availability that already has ALL the requested days linked.
  const existing = await prisma.serviceAvailability.findFirst({
    where: {
      serviceId,
      hasSlots: block.hasSlots,
      workFromTime: block.workFromTime,
      workToTime: block.workToTime,
    },
    include: { workingDays: true },
  });

  if (existing) {
    const existingDays = new Set(existing.workingDays.map((d) => d.dayOfWeek));
    const allPresent = block.days.every((d) => existingDays.has(d));
    if (allPresent) return; // already seeded
  }

  await prisma.serviceAvailability.create({
    data: {
      serviceId,
      workFromTime: block.workFromTime,
      workToTime: block.workToTime,
      capacity: block.capacity,
      hasSlots: block.hasSlots,
      workingDays: {
        create: block.days.map((dayOfWeek) => ({ dayOfWeek, serviceId })),
      },
      timeSlots: block.timeSlots
        ? { create: block.timeSlots }
        : undefined,
    },
  });
}

/** Standard weekday set (Sun–Thu, no Friday/Saturday). */
export const WEEKDAYS: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
];

/** All 7 days. */
export const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

/** Weekend only (Fri + Sat for Jordan). */
export const WEEKEND_DAYS: DayOfWeek[] = [
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];
