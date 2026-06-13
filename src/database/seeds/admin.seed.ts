// admin.seed.ts

import {
  PrismaClient,
  UserRole,
  AccountStatus,
} from '@prisma/client';

import * as bcrypt from 'bcrypt';

export async function seedAdmin(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(
    'Admin@123456',
    12,
  );

  const admin = await prisma.user.upsert({
    where: {
      email: 'admin@yourdomain.com',
    },
    update: {},
    create: {
      fullName: 'Super Admin',
      email: 'admin@yourdomain.com',
      passwordHash,
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerified: true,
    },
  });

  console.log('✅ Super Admin:', admin.email);

  const serviceTypes = [
    'FOOD',
    'PHOTOGRAPHY',
    'FAVORS',
    'DECORATION',
    'HALL',
    'SOUND',
  ];

  for (const name of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `${name} service`,
      },
    });
  }

  console.log('✅ ServiceTypes created');
}