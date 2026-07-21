import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FulfillmentStatus } from '@prisma/client';

export class UpdateDeliveryStatusDto {
  @ApiProperty({ enum: FulfillmentStatus, example: FulfillmentStatus.OUT_FOR_DELIVERY })
  @IsEnum(FulfillmentStatus)
  status: FulfillmentStatus;

  @ApiPropertyOptional({ example: 'Left with the venue coordinator' })
  @IsOptional()
  @IsString()
  notes?: string;
}
