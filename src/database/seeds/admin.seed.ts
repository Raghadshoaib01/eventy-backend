// src/database/seeds/admin.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds the super-admin user and all reference / lookup data:
//   • ServiceTypes  (6 types with rich descriptions)
// ─────────────────────────────────────────────────────────────────────────────

import { AccountStatus, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SERVICE_TYPES = [
  {
    name: 'FOOD',
    description:
      'Catering and food services for events — buffets, platters, beverages, and desserts.',
  },
  {
    name: 'PHOTOGRAPHY',
    description:
      'Professional photo and video coverage for events — portrait sessions, cinematic reels, and drone shots.',
  },
  {
    name: 'FAVORS',
    description:
      'Customised guest gifts and party favours — personalised items, gift boxes, and branded keepsakes.',
  },
  {
    name: 'DECORATION',
    description:
      'Event decoration and styling services — floral arrangements, lighting, table setups, and themed décor.',
  },
  {
    name: 'HALL',
    description:
      'Venue and hall rental for events — ballrooms, banquet halls, outdoor spaces, and rooftop terraces.',
  },
  {
    name: 'SOUND',
    description:
      'Audio-visual and sound equipment services — DJ sets, PA systems, lighting rigs, and live music.',
  },
];

export async function seedAdmin(prisma: PrismaClient) {
  // ── Super Admin ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@eventy.com' },
    update: {},
    create: {
      fullName: 'Super Admin',
      email: 'admin@eventy.com',
      passwordHash,
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerified: true,
    },
  });

  console.log('✅ Super Admin:', admin.email);

  // ── Service Types ───────────────────────────────────────────────────────────
  for (const st of SERVICE_TYPES) {
    await prisma.serviceType.upsert({
      where: { name: st.name },
      update: { description: st.description },
      create: { name: st.name, description: st.description },
    });
  }

  console.log('✅ ServiceTypes created/updated:', SERVICE_TYPES.map((s) => s.name).join(', '));
}