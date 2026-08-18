// src/database/seeds/customers.seed.ts
import { AccountStatus, PrismaClient, UserRole } from '@prisma/client';
import { getSeedPasswordHash } from './helpers.seed';

export interface SeededCustomer {
  userId: string;
  customerId: string;
  email: string;
  fullName: string;
}

const CUSTOMER_DEFS = [
  {
    fullName: 'Ahmad Al-Rashid',
    email: 'ahmad@eventy.com',
    phone: '+962790000001',
    locationName: 'Amman, Jordan',
    latitude: 31.9522,
    longitude: 35.9312,
  },
  {
    fullName: 'Dina Haddad',
    email: 'dina@eventy.com',
    phone: '+962790000002',
    locationName: 'Amman, Jordan',
    latitude: 31.9621,
    longitude: 35.9010,
  },
];

export async function seedCustomers(prisma: PrismaClient): Promise<SeededCustomer[]> {
  const passwordHash = await getSeedPasswordHash();
  const result: SeededCustomer[] = [];

  for (const def of CUSTOMER_DEFS) {
    let user = await prisma.user.findUnique({ where: { email: def.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: def.fullName,
          email: def.email,
          phoneNumber: def.phone,
          passwordHash,
          role: UserRole.CUSTOMER,
          status: AccountStatus.ACTIVE,
          emailVerified: true,
          locationName: def.locationName,
          latitude: def.latitude,
          longitude: def.longitude,
          customer: { create: {} },
        },
        include: { customer: true },
      });
      console.log('  ✅ Customer created:', user.email);
    } else {
      console.log('  ⚠️  Customer exists, skipping:', user.email);
    }

    let customerRecord = await prisma.customer.findUnique({ where: { userId: user.id } });
    if (!customerRecord) {
      customerRecord = await prisma.customer.create({ data: { userId: user.id } });
    }

    result.push({
      userId: user.id,
      customerId: customerRecord.id,
      email: user.email,
      fullName: user.fullName,
    });
  }

  console.log('✅ Customers seeded:', result.map((c) => c.email).join(', '));
  return result;
}