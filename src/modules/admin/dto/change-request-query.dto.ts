import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApprovalStatus, ChangeRequestTargetType, ChangeRequestType } from '@prisma/client';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export class ChangeRequestQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ChangeRequestTargetType })
  @IsOptional()
  @IsEnum(ChangeRequestTargetType)
  targetType?: ChangeRequestTargetType;

  @ApiPropertyOptional({ enum: ChangeRequestType })
  @IsOptional()
  @IsEnum(ChangeRequestType)
  requestType?: ChangeRequestType;

  @ApiPropertyOptional({ enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}
