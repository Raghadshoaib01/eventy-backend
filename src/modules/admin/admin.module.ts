import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUseresService } from './admin-useres.service';
import { AdminApprovalController } from './AdminApprovalController';
import { AdminApprovalService } from './admin-approval-service.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  providers: [AdminUseresService, AdminApprovalService, DomainEventBus],
  controllers: [AdminUsersController, AdminApprovalController],
})
export class AdminModule {}
