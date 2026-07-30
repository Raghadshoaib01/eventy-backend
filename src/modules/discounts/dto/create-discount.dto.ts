import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { DiscountScope } from '@prisma/client';
import { IsTodayOrFuture } from 'src/common/validators/future-date.validator';

export class CreateDiscountDto {
  @ApiProperty({ enum: DiscountScope, example: DiscountScope.SERVICE })
  @IsEnum(DiscountScope)
  scope: DiscountScope;

  @ApiPropertyOptional({ example: 'uuid-of-own-service', description: 'Required when scope = SERVICE' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-own-package', description: 'Required when scope = PACKAGE' })
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ApiProperty({ example: 10, description: '0–100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentOff: number;

  @ApiPropertyOptional({
    example: 'WEDDING10',
    description: 'null/omitted = auto-applied on the listing; set = customer enters it at checkout',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  @IsTodayOrFuture()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  @IsTodayOrFuture()
  endsAt?: string;
}
