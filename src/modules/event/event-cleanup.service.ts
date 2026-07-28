// src/modules/event/event-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/database/prisma.service';

const COMPLETION_GRACE_HOURS = 24;

@Injectable()
export class EventCleanupService {
  private readonly logger = new Logger(EventCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async completePastEvents() {
    const now = new Date();
    const events = await this.prisma.event.findMany({
      where: { status: 'IN_PROGRESS', eventDate: { lte: now } },
      include: { bookings: { select: { id: true, status: true } } },
    });

    for (const event of events) {
      const [endH, endM] = event.eventEndTime.split(':').map(Number);
      const [startH] = event.eventStartTime.split(':').map(Number);
      const endsNextDay = endH < startH;
      const eventEnd = new Date(event.eventDate);
      eventEnd.setHours(endH, endM, 0, 0);
      if (endsNextDay) eventEnd.setDate(eventEnd.getDate() + 1);
      if (eventEnd > now) continue;

      await this.prisma.booking.updateMany({
        where: { eventId: event.id, status: { in: ['PENDING', 'QUOTE_SENT'] } },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledBy: 'SYSTEM',
          cancellationReason: 'Event date has passed without a final decision',
        },
      });

      const gracePassed = now.getTime() - eventEnd.getTime() >= COMPLETION_GRACE_HOURS * 60 * 60 * 1000;
      if (gracePassed) {
        await this.prisma.booking.updateMany({
          where: { eventId: event.id, status: 'IN_PROGRESS' },
          data: { status: 'COMPLETED', completedAt: now },
        });
      }

      const stillOpen = await this.prisma.booking.count({
        where: { eventId: event.id, status: { in: ['PENDING', 'QUOTE_SENT', 'IN_PROGRESS'] } },
      });
      if (stillOpen === 0) {
        await this.prisma.event.update({ where: { id: event.id }, data: { status: 'COMPLETED' } });
        this.logger.log(`Event ${event.id} marked COMPLETED`);
      }
    }
  }
}