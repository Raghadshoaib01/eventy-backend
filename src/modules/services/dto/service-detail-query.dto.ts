// src/modules/services/dto/service-detail-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

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
}