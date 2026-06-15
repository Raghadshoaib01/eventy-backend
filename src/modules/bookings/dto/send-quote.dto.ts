// src/modules/bookings/dto/send-quote.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuoteItemDto {
  @ApiProperty({ example: 'uuid-of-booking-item' })
  @IsNotEmpty()
  @IsString()
  bookingItemId: string;

  @ApiProperty({ example: 25.0, description: 'New unit price set by provider' })
  @IsNumber()
  @Min(0)
  finalUnitPrice: number;
}

export class SendQuoteDto {
  @ApiPropertyOptional({
    type: [QuoteItemDto],
    description: 'Required for services WITH sub-services (FOOD, PHOTOGRAPHY…)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];

  @ApiPropertyOptional({
    example: 2500.0,
    description: 'Required for services WITHOUT sub-services (HALL, SOUND)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalAmount?: number;

  @ApiPropertyOptional({ example: 'Price includes setup and cleanup.' })
  @IsOptional()
  @IsString()
  providerNotes?: string;
}