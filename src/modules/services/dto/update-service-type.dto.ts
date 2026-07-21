import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateServiceTypeDto {
  @ApiPropertyOptional({ example: 'Hall' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Identifies a "Hall"-like type for GUEST_BASED packages (docs/packages-implementation-plan.md §2.4)',
  })
  @IsOptional()
  @IsBoolean()
  isVenue?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether services of this type require delivery by default (docs/delivery-implementation-plan.md §2)',
  })
  @IsOptional()
  @IsBoolean()
  requiresDeliveryByDefault?: boolean;
}
