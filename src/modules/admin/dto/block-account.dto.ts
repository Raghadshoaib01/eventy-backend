import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BlockAccountDto {
  @ApiPropertyOptional({ example: 'Repeated policy violations' })
  @IsOptional()
  @IsString()
  reason?: string;
}
