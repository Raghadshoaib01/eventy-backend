import { Module } from '@nestjs/common';
import { PackagesController } from './controllers/packages.controller';
import { PublicPackagesController } from './controllers/public-packages.controller';
import { PackagesService } from './packages.service';
import { ServicesModule } from '../services/services.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  imports: [ServicesModule, DiscountsModule, DeliveryModule],
  controllers: [PackagesController, PublicPackagesController],
  providers: [PackagesService, DomainEventBus],
  exports: [PackagesService],
})
export class PackagesModule {}
