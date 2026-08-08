// src/modules/packages/dto/package-booking-cancel.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PackageBookingCancelDto {
  @ApiPropertyOptional({ example: 'Plans changed' })
  @IsOptional()
  @IsString()
  reason?: string;
}
