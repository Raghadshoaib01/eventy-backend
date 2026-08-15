import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PackageEventBookingStatus } from '@prisma/client';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export class PackageBookingQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PackageEventBookingStatus })
  @IsOptional()
  @IsEnum(PackageEventBookingStatus)
  status?: PackageEventBookingStatus;
}