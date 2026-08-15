// src/modules/blocked-slots/dto/blocked-slots-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class BlockedSlotsCalendarQueryDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  fromDate: string;

  @ApiProperty({ example: '2026-09-07' })
  @IsDateString()
  toDate: string;
}