import { PrismaClient } from '@prisma/client';

import { seedAdmin } from './admin.seed';
import { seedProvider } from './provider.seed';
const prisma = new PrismaClient();

async function main() {

  console.log('\n===== Seed Admin =====');

  await seedAdmin(prisma);

  console.log('\n===== Seed Provider =====');

  await seedProvider(prisma);

  console.log('\n🎉 All seeds completed');
}

main()
  .catch((e) => {

    console.error(e);

    process.exit(1);

  })
  .finally(async () => {

    await prisma.$disconnect();

  });