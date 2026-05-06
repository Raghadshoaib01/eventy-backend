import { Module } from '@nestjs/common';
import { ServicesController } from './controllers/services.controller';
import { SubServiceController } from './controllers/sub-services.controller';
import { ServiceDetailsController } from './controllers/servicedetails.controller';
import { ServicesService } from './services.service';
import { SubServiceService} from './sub-services.service';
import { ServiceDetailsService } from './service details.service';


@Module({
  controllers: [
    ServicesController,
    SubServiceController,
    ServiceDetailsController
  ],

 providers: [ServicesService,SubServiceService,ServiceDetailsService],
   exports: [ServicesService],
})
export class ServicesModule {}
