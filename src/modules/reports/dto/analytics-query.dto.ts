import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    example: 'FOOD',
    description: 'Service type name to scope the top-providers ranking to. Omit for the overall ranking.',
  })
  @IsOptional()
  @IsString()
  serviceType?: string;
}
