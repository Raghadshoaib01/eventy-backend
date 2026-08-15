// src/modules/packages/dto/update-package.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePackageDto {
  @ApiPropertyOptional({ example: 'Royal Wedding Package v2' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 15, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({ type: [String], description: 'Service IDs to add (DRAFT only)' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  addServiceIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Service IDs to remove (DRAFT only)' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  removeServiceIds?: string[];
}
