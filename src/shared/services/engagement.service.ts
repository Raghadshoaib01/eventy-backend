import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

export type EngagementTargetType = 'USER' | 'PROVIDER' | 'SERVICE' | 'SUB_SERVICE';

/**
 * hasActiveEngagement(entity): true when the target has a Booking with
 * status CONFIRMED|IN_PROGRESS inside an Event with status DRAFT|IN_PROGRESS.
 * Used to freeze block/unblock and edit actions that would disrupt a live event.
 */
@Injectable()
export class EngagementService {
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveEngagement(
    targetType: EngagementTargetType,
    targetId: string,
  ): Promise<boolean> {
    const where: Prisma.BookingWhereInput = {
      status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
      event: { status: { in: ['DRAFT', 'IN_PROGRESS'] } },
    };

    switch (targetType) {
      case 'USER':
        where.customerId = targetId;
        break;
      case 'PROVIDER':
        where.providerId = targetId;
        break;
      case 'SERVICE':
        where.serviceId = targetId;
        break;
      case 'SUB_SERVICE':
        where.items = { some: { subServiceId: targetId } };
        break;
    }

    const count = await this.prisma.booking.count({ where });
    return count > 0;
  }
}
