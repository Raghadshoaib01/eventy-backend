// src/modules/bookings/dto/quote-decision.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class QuoteDecisionDto {
  @ApiProperty({
    example: true,
    description: 'true = confirm the quote, false = reject the quote',
  })
  @IsBoolean()
  accept: boolean;
}
