import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUseresService } from './admin-useres.service';

@Module({
    providers: [AdminUseresService
      ],
  controllers: [AdminUsersController]
})
export class AdminModule {}
