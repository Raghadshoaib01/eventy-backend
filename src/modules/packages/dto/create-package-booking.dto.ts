import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePackageBookingDto {
  @ApiPropertyOptional({ example: 150, description: 'Required for GUEST_BASED packages (docs §12.3)' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ type: [String], example: ['uuid-1', 'uuid-2'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  optionalServiceIds?: string[];

  @ApiPropertyOptional({ example: 'uuid-of-an-existing-event-owned-by-the-caller' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ example: 'WEDDING10', description: 'Coupon code for a code-based package discount' })
  @IsOptional()
  @IsString()
  discountCode?: string;
}
