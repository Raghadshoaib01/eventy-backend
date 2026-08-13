// src/modules/packages/dto/create-package.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * A single package member requested at creation time. The serviceId must
 * belong to the calling provider (docs/implementation_plan.md §3 — packages
 * are scoped to a single provider in the current architecture; the join
 * request workflow is the mechanism for adding partner services when that
 * is later permitted).
 */
export class PackageServiceInputDto {
  @ApiProperty({ example: 'uuid-of-service' })
  @IsUUID()
  serviceId: string;
}

export class CreatePackageDto {
  @ApiProperty({ example: 'Royal Wedding Package' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'All-inclusive wedding package' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: 100,
    description: 'Discount percent applied to the package total at activation',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiProperty({
    type: [PackageServiceInputDto],
    description: 'two or more serviceIds to attach to this package',
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => PackageServiceInputDto)
  services: PackageServiceInputDto[];
}
