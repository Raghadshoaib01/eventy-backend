import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectBookingDto {
  @ApiPropertyOptional({
    example: 'Provider is unavailable on the requested date.',
    description: 'Optional reason for rejecting the booking.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}