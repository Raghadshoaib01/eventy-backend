import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ComplaintTargetType } from '@prisma/client';

export class CreateComplaintDto {
  @ApiProperty({ enum: ComplaintTargetType, example: ComplaintTargetType.PROVIDER })
  @IsEnum(ComplaintTargetType)
  targetType: ComplaintTargetType;

  @ApiPropertyOptional({ example: 'uuid-of-the-provider-service-or-customer', description: 'Omit for GENERAL' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-a-booking-for-context' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-a-package-booking-for-context' })
  @IsOptional()
  @IsUUID()
  packageBookingId?: string;

  @ApiProperty({ example: 'Provider arrived late' })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ example: 'The provider arrived over an hour late with no prior notice.' })
  @IsNotEmpty()
  @IsString()
  description: string;
}
