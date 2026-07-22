// src/modules/services/dto/service-detail-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ServiceDetailQueryDto {
  @ApiPropertyOptional({ description: 'Files page (default: 1)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  filesPage?: number = 1;

  @ApiPropertyOptional({ description: 'Files per page (default: 5)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  filesLimit?: number = 5;

  @ApiPropertyOptional({ description: 'Sub-services page (default: 1)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  subsPage?: number = 1;

  @ApiPropertyOptional({ description: 'Sub-services per page (default: 10)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  subsLimit?: number = 10;

  @ApiPropertyOptional({
    description:
      'ISO date. If provided, availability/timeSlots returned are filtered to that day only. Omit to get full weekly availability.2026-08-15',
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  date?: string;
}