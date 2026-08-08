// src/modules/suggested-packages/dto/update-suggested-package.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { SuggestedPackageStatus } from '@prisma/client';

export class UpdateSuggestedPackageDto {
  @ApiPropertyOptional({ example: 'Starter Wedding Bundle v2' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SuggestedPackageStatus })
  @IsOptional()
  @IsEnum(SuggestedPackageStatus)
  status?: SuggestedPackageStatus;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replacement set of service IDs',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  serviceIds?: string[];
}
