import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ComplaintStatus } from '@prisma/client';

export class UpdateComplaintStatusDto {
  @ApiProperty({ enum: ComplaintStatus, example: ComplaintStatus.IN_PROGRESS })
  @IsEnum(ComplaintStatus)
  status: ComplaintStatus;
}
