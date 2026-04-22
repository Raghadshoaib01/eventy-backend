import {
  PrismaClient,
  UserRole,
  AccountStatus,
  ApprovalStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@yourdomain.com' },
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

  console.log('✅ Super Admin created:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
