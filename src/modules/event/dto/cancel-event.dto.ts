// src/modules/event/dto/cancel-event.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelEventDto {
  @ApiPropertyOptional({
    example: 'Change of plans — event postponed indefinitely.',
    description: 'Optional reason shown to affected providers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}