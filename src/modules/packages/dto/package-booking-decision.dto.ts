// src/modules/packages/dto/package-booking-decision.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Shared DTO for the package-owner's accept / reject decision on a
 * customer's PackageEventBooking (implementation_plan.md §3).
 */
export class PackageBookingDecisionDto {
  @ApiPropertyOptional({
    example: 'Date no longer available',
    description: 'Optional rejection reason',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
