import { Module } from '@nestjs/common';
import { DiscountsController } from './controllers/discounts.controller';
import { AdminDiscountsController } from './controllers/admin-discounts.controller';
import { DiscountsService } from './discounts.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  controllers: [DiscountsController, AdminDiscountsController],
  providers: [DiscountsService, DomainEventBus],
  exports: [DiscountsService],
})
export class DiscountsModule {}
