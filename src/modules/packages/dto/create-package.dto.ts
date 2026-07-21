import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PackagePricingStrategy } from '@prisma/client';

export class CreatePackageDto {
  @ApiProperty({ example: 'Grand Wedding Bundle' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Hall + catering + photography, booked together.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: PackagePricingStrategy,
    default: PackagePricingStrategy.FLAT_SUM,
    description:
      'GUEST_BASED for Hall packages (docs/packages-implementation-plan.md §7, §11); FLAT_SUM otherwise.',
  })
  @IsOptional()
  @IsEnum(PackagePricingStrategy)
  pricingStrategy?: PackagePricingStrategy;
}
