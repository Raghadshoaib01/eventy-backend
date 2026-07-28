import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { BookingsModule } from '../bookings/bookings.module';
import { EventCleanupService } from './event-cleanup.service';

@Module({
  imports: [BookingsModule],
  controllers: [EventController],
  providers: [EventService, DomainEventBus,EventCleanupService],
})
export class EventModule {}
