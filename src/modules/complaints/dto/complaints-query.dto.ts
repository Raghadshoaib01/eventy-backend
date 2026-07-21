import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplaintStatus, ComplaintTargetType } from '@prisma/client';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export class ComplaintsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ComplaintStatus })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @ApiPropertyOptional({ enum: ComplaintTargetType })
  @IsOptional()
  @IsEnum(ComplaintTargetType)
  targetType?: ComplaintTargetType;

  @ApiPropertyOptional({ example: 'late', description: 'Free-text search across subject/description' })
  @IsOptional()
  @IsString()
  search?: string;
}
