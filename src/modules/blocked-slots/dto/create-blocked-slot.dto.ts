// src/modules/blocked-slots/dto/create-blocked-slot.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateBlockedSlotDto {
  @ApiPropertyOptional({ description: 'اتركه فارغاً لحجب كل خدماتك (مثال: إجازة)' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  fromDate: string;

  @ApiPropertyOptional({ example: '2026-09-07', description: 'اتركه فارغاً ليكون الحجب ليوم واحد فقط' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: '14:00', description: 'اتركه فارغاً لحجب اليوم بالكامل' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid time format. Use HH:mm' })
  fromTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid time format. Use HH:mm' })
  toTime?: string;

  @ApiPropertyOptional({ example: 'إجازة سنوية' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}