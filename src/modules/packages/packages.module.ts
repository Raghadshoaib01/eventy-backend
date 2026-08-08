// src/modules/packages/packages.module.ts
import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PackagesCronService } from './packages-cron.service';
import { DiscountsModule } from '../discounts/discounts.module';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  imports: [DiscountsModule],
  controllers: [PackagesController],
  providers: [PackagesService, PackagesCronService, DomainEventBus],
  exports: [PackagesService],
})
export class PackagesModule {}
