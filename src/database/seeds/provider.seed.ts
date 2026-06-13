// src/database/seeds/provider.seed.ts
import {
  PrismaClient,
  UserRole,
  AccountStatus,
  ApprovalStatus,
  DayOfWeek,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';


export async function seedProvider(
  prisma: PrismaClient,
) {  const existing = await prisma.user.findUnique({
    where: { email: 'anas@nabaah.com' },
  });
  if (existing) {
    console.log('⚠️  NABAAH seed already exists — skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash('Nabaah@123456', 12);

  await prisma.$transaction(async (tx) => {
    // ── 1. User + ServiceProvider ──────────────────────────
    const user = await tx.user.create({
      data: {
        fullName: 'Anas Nabaah',
        email: 'anas@nabaah.com',
        phoneNumber: '+962791100001',
        passwordHash,
        role: UserRole.PROVIDER,
        status: AccountStatus.ACTIVE,
        emailVerified: true,
        locationName: 'Amman, Jordan',
        latitude: 31.9539,
        longitude: 35.9106,
        provider: {
          create: {
            businessName: 'NABAAH',
            businessLicense: 'CR-NABAAH-20251001',
            description:
              'Premium food and catering services for all occasions.',
            approvalStatus: ApprovalStatus.APPROVED,
          },
        },
      },
      include: { provider: true },
    });

    const provider = user.provider!;
    console.log('✅ User + Provider:', user.email);
    
    // ── FOOD_TYPE_ID ─────────────────────────────────────────
        const foodType =
    await tx.serviceType.findUnique({
        where: {
        name: 'FOOD',
        },
    });

    if (!foodType) {
    throw new Error(
        'FOOD ServiceType not found',
    );
    }
    // ── 2. Service ─────────────────────────────────────────
    const service = await tx.service.create({
      data: {
        providerId: provider.id,
        serviceTypeId: foodType.id,
        description:
          'Premium catering for weddings, graduations, engagements, and all occasions.',
        approvalStatus: 'ACTIVE',
        isCompleted: true,
        eventTypes: {
          create: [
            { eventType: 'WEDDING' },
            { eventType: 'GRADUATION' },
            { eventType: 'ENGAGEMENT' },
            { eventType: 'BIRTHDAY' },
            { eventType: 'ALL_EVENTS' },
          ],
        },
      },
    });

    console.log('✅ Service:', service.id);

    // ── 3. Availability: كل الأيام عدا الثلاثاء ────────────
    await tx.serviceAvailability.create({
      data: {
        serviceId: service.id,
        workFromTime: '09:00',
        workToTime: '20:00',
        capacity: 1000,
        hasSlots: false,
        workingDays: {
          create: [
            { dayOfWeek: DayOfWeek.SUNDAY,    serviceId: service.id },
            { dayOfWeek: DayOfWeek.MONDAY,    serviceId: service.id },
            { dayOfWeek: DayOfWeek.WEDNESDAY, serviceId: service.id },
            { dayOfWeek: DayOfWeek.THURSDAY,  serviceId: service.id },
            { dayOfWeek: DayOfWeek.FRIDAY,    serviceId: service.id },
            { dayOfWeek: DayOfWeek.SATURDAY,  serviceId: service.id },
          ],
        },
      },
    });

    // ── 4. Availability: الثلاثاء بـ time slots ────────────
    await tx.serviceAvailability.create({
      data: {
        serviceId: service.id,
        workFromTime: '09:00',
        workToTime: '20:00',
        capacity: 1000,
        hasSlots: true,
        workingDays: {
          create: [{ dayOfWeek: DayOfWeek.TUESDAY, serviceId: service.id }],
        },
        timeSlots: {
          create: [
            { fromTime: '10:00', toTime: '12:00', capacity: 400 },
            { fromTime: '13:00', toTime: '23:00', capacity: 400 },
          ],
        },
      },
    });

    console.log('✅ Availability + TimeSlots created');

    // ── 5. SubServices ─────────────────────────────────────
    await tx.subService.createMany({
      data: [
        {
          serviceId: service.id,
          name: 'Deluxe Cassita',
          description: 'Premium deluxe cassita platter for large gatherings.',
          pricePerUnit: 18.0,
          unitType: 'ITEM',
          dailyCapacity: 500,
          isAvailable: true,
        },
        {
          serviceId: service.id,
          name: 'Fresh Berry Juice',
          description: 'Freshly squeezed seasonal berry juice served chilled.',
          pricePerUnit: 3.5,
          unitType: 'ITEM',
          dailyCapacity: 1000,
          isAvailable: true,
        },
      ],
    });

    console.log('✅ SubServices created');

    // ── 6. BankAccount ─────────────────────────────────────
    await tx.bankAccount.create({
      data: {
        userId: user.id,
        iban: 'JO94CBJO0010000000000131000302',
        bankName: 'Arab Bank',
        accountHolderName: 'Anas Nabaah',
        isVerified: true,
      },
    });

    console.log('✅ BankAccount created');
  });

  console.log('\n🎉 NABAAH seed done!');
  console.log('   Email    : anas@nabaah.com');
  console.log('   Password : Nabaah@123456');
}
