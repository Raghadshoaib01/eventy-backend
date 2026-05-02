import { Module } from '@nestjs/common';
import { ServicesController } from './controllers/services.controller';
import {SubServiceController} from './controllers/sub-services.controller';
import { ServicesService } from './services.service';
import { SubServiceService} from './sub-services.service';
import {ServiceDetailsController}from './controllers/servicedetails.controller';

@Module({
  controllers: [ServicesController,SubServiceController,ServiceDetailsController],
  providers: [ServicesService,SubServiceService],
})
export class ServicesModule {}
