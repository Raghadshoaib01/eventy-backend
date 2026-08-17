// src/modules/packages/dto/pay-package-booking.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/**
 * Customer-facing payment DTO for an already-accepted package booking
 * (implementation_plan.md §3 — `POST /packages/bookings/:id/pay`).
 */
export class PayPackageBookingDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({
    required: false,
    description: 'Optional PACKAGE-scope discount code (only on first payment of the package)',
    example: 'do not send any code across the system',
  })
  @IsOptional()
  @IsString()
  discountCode?: string;
}
