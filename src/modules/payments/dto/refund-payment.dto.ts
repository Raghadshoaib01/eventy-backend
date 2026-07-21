import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefundPaymentDto {
  @ApiPropertyOptional({ example: 'Customer cancelled before service delivery' })
  @IsOptional()
  @IsString()
  reason?: string;
}
