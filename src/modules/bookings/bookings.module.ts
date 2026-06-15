import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ProviderBookingsController } from './provider-bookings.controller';
import { ProviderBookingsService } from './provider-bookings.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  providers: [BookingsService,ProviderBookingsService, DomainEventBus],
  controllers: [BookingsController,ProviderBookingsController]
})
export class BookingsModule {}
