import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ProviderBookingsController } from './provider-bookings.controller';
import { ProviderBookingsService } from './provider-bookings.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { DeliveryModule } from '../delivery/delivery.module';
import { BookingCleanupService } from './booking-cleanup.service';

@Module({
  imports: [DeliveryModule],
  providers: [BookingsService,ProviderBookingsService, DomainEventBus,BookingCleanupService],
  controllers: [BookingsController,ProviderBookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
