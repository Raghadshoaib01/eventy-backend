// src/modules/services/dto/available-services-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export class AvailableServicesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ServiceStatus,
    description:
      'Filter by service approval status. ' +
      'Default (omit): ACTIVE + completed only. ' +
      'Admin can pass any value: PENDING_APPROVAL, PENDING_DETAILS, ACTIVE, INACTIVE, REJECTED.',
  })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
  
  @ApiPropertyOptional({ 
    description: 'Service type name: FOOD, PHOTOGRAPHY, FAVORS, DECORATION, HALL, SOUND. Omit to return all.',
    })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Event date ISO string. Filters services that work on this day of week. Omit to return all.',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Number of guests. Filters by maxCapacity >= guests. Omit to return all.',
    })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({
  description:
      'Total budget in JD. ' +
      'HALL/SOUND: service.price <= budget. ' +
      'ITEM sub-services: pricePerUnit × guests <= budget. ' +
      'SESSION sub-services: pricePerUnit <= budget. ' +
      'Requires guests when provided.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  budget?: number;

}