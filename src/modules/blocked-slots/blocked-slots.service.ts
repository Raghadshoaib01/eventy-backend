// src/modules/blocked-slots/blocked-slots.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';

const MAX_BLOCK_DAYS = 31;
const ACTIVE_BOOKING_STATUSES = ['PENDING', 'QUOTE_SENT', 'CONFIRMED', 'IN_PROGRESS'] as const;

@Injectable()
export class BlockedSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveProvider(userId: string) {
    const provider = await this.prisma.serviceProvider.findFirst({ where: { userId } });
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  async create(userId: string, dto: CreateBlockedSlotDto) {
    const provider = await this.resolveProvider(userId);

    if (dto.serviceId) {
      const svc = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, providerId: provider.id },
      });
      if (!svc) throw new NotFoundException('Service not found or not owned by you');
    }

    if ((dto.fromTime && !dto.toTime) || (!dto.fromTime && dto.toTime)) {
      throw new BadRequestException('fromTime and toTime must be provided together');
    }
    if (dto.fromTime && dto.toTime && dto.fromTime >= dto.toTime) {
      throw new BadRequestException('fromTime must be earlier than toTime');
    }

    const fromDate = new Date(dto.fromDate);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = dto.toDate ? new Date(dto.toDate) : new Date(fromDate);
    toDate.setHours(0, 0, 0, 0);

    if (toDate < fromDate) {
      throw new BadRequestException('toDate cannot be before fromDate');
    }

    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (diffDays > MAX_BLOCK_DAYS) {
      throw new BadRequestException(`Blocked range cannot exceed ${MAX_BLOCK_DAYS} days`);
    }

    const groupId = randomUUID();
    const rows = Array.from({ length: diffDays }, (_, i) => {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + i);
      return {
        serviceId: dto.serviceId ?? null,
        providerId: provider.id,
        date: d,
        fromTime: dto.fromTime,
        toTime: dto.toTime,
        reason: dto.reason,
        groupId,
      };
    });

    await this.prisma.blockedSlot.createMany({ data: rows });

    const created = await this.prisma.blockedSlot.findMany({
      where: { groupId },
      orderBy: { date: 'asc' },
    });

    return { message: 'Blocked slot(s) created successfully', data: created };
  }

  async findOne(userId: string, id: string) {
    const provider = await this.resolveProvider(userId);
    const slot = await this.prisma.blockedSlot.findFirst({
      where: { id, providerId: provider.id },
      include: { service: { include: { serviceType: { select: { name: true } } } } },
    });
    if (!slot) throw new NotFoundException('Blocked slot not found');
    return { message: 'Blocked slot retrieved successfully', data: slot };
  }

  async remove(userId: string, id: string, wholeGroup: boolean) {
    const provider = await this.resolveProvider(userId);
    const slot = await this.prisma.blockedSlot.findFirst({
      where: { id, providerId: provider.id },
    });
    if (!slot) throw new NotFoundException('Blocked slot not found');

    if (wholeGroup && slot.groupId) {
      await this.prisma.blockedSlot.deleteMany({
        where: { groupId: slot.groupId, providerId: provider.id },
      });
      return { message: 'Blocked slot range deleted successfully', data: null };
    }

    await this.prisma.blockedSlot.delete({ where: { id } });
    return { message: 'Blocked slot deleted successfully', data: null };
  }

  /** لوحة تقويم المزود: تُعيد الحجوزات النشطة و الـ blocked slots بشكل منفصل، كلٌ مرتّب حسب تاريخه */
  async getCalendar(userId: string, fromDateRaw: string, toDateRaw: string) {
    const provider = await this.resolveProvider(userId);

    const fromDate = new Date(fromDateRaw);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(toDateRaw);
    toDate.setHours(23, 59, 59, 999);

    if (toDate < fromDate) {
      throw new BadRequestException('toDate cannot be before fromDate');
    }

    const [blockedSlots, bookings] = await Promise.all([
      this.prisma.blockedSlot.findMany({
        where: { providerId: provider.id, date: { gte: fromDate, lte: toDate } },
        include: { service: { include: { serviceType: { select: { name: true } } } } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: {
          providerId: provider.id,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          event: { eventDate: { gte: fromDate, lte: toDate } },
        },
        include: {
          event: { select: { name: true, eventDate: true, eventStartTime: true, eventEndTime: true } },
          service: { include: { serviceType: { select: { name: true } } } },
          customer: { select: { fullName: true } },
        },
        orderBy: { event: { eventDate: 'asc' } },
      }),
    ]);

    return {
      message: 'Calendar retrieved successfully',
      data: { blockedSlots, bookings },
    };
  }
}