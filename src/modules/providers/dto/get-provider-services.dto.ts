import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetProviderServicesDto {
  @ApiPropertyOptional({
    enum: ServiceStatus,
    example: ServiceStatus.ACTIVE,
    description: 'Filter services by approval status',
  })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @ApiPropertyOptional({
    example: 'service-type-uuid',
    description: 'Filter services by service type ID',
  })
  @IsOptional()
  @IsString()
  serviceTypeId?: string;
}
