import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
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
}