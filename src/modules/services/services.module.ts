import { Module } from '@nestjs/common';
import { ServicesController } from './controllers/services.controller';
import { SubServiceController } from './controllers/sub-services.controller';
import { ServiceDetailsController } from './controllers/servicedetails.controller';
import { ServicesService } from './services.service';
import { SubServiceService} from './sub-services.service';
import { ServiceDetailsService } from './service details.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';


import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [DiscountsModule],
  controllers: [
    ServicesController,
    SubServiceController,
    ServiceDetailsController
  ],

 providers: [ServicesService,SubServiceService,ServiceDetailsService,DomainEventBus],
   exports: [ServicesService],
})
export class ServicesModule {}
