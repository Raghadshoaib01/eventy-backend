import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  controllers: [EventController],
  providers: [EventService, DomainEventBus],
})
export class EventModule {}
