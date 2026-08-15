// src/modules/blocked-slots/blocked-slots.module.ts
import { Module } from '@nestjs/common';
import { BlockedSlotsService } from './blocked-slots.service';
import { BlockedSlotsController } from './blocked-slots.controller';

@Module({
  providers: [BlockedSlotsService],
  controllers: [BlockedSlotsController]
})
export class BlockedSlotModule {}
