import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { EventStatus } from '@prisma/client';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export class GetEventsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: EventStatus,
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({
    example: '2026-06-09',
    description: 'Filter events with eventDate >= this date (used by the calendar view)',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    example: '2026-06-15',
    description: 'Filter events with eventDate <= this date (used by the calendar view)',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}