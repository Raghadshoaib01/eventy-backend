import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ProviderBookingsController } from './provider-bookings.controller';
import { ProviderBookingsService } from './provider-bookings.service';

@Module({
  providers: [BookingsService,ProviderBookingsService],
  controllers: [BookingsController,ProviderBookingsController]
})
export class BookingsModule {}
