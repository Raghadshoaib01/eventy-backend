// src/modules/suggested-packages/suggested-packages.module.ts
import { Module } from '@nestjs/common';
import { SuggestedPackagesController } from './suggested-packages.controller';
import { SuggestedPackagesService } from './suggested-packages.service';

@Module({
  controllers: [SuggestedPackagesController],
  providers: [SuggestedPackagesService],
  exports: [SuggestedPackagesService],
})
export class SuggestedPackagesModule {}
