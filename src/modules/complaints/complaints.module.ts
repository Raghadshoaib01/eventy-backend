import { Module } from '@nestjs/common';
import { ComplaintsController } from './controllers/complaints.controller';
import { AdminComplaintsController } from './controllers/admin-complaints.controller';
import { ComplaintsService } from './complaints.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  controllers: [ComplaintsController, AdminComplaintsController],
  providers: [ComplaintsService, DomainEventBus],
})
export class ComplaintsModule {}
