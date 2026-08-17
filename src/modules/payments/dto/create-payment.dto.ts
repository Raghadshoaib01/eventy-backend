import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-of-a-CONFIRMED-booking' })
  @IsUUID()
  bookingId: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ example: 'do not send any code across the system', description: 'do not send any code across the system' })
  @IsOptional()
  @IsString()
  discountCode?: string;
}
