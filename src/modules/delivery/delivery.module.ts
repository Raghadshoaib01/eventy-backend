import { Module } from '@nestjs/common';
import { ProviderDeliveriesController } from './controllers/provider-deliveries.controller';
import { BookingDeliveryController } from './controllers/booking-delivery.controller';
import { DeliveryService } from './delivery.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  controllers: [ProviderDeliveriesController, BookingDeliveryController],
  providers: [DeliveryService, DomainEventBus],
  exports: [DeliveryService],
})
export class DeliveryModule {}
