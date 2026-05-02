import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '@prisma/client';

class BookingItemDto {
  @ApiProperty({ example: 'uuid-of-subservice' })
  @IsNotEmpty()
  @IsString()
  subServiceId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-of-service' })
  @IsNotEmpty()
  @IsString()
  serviceId: string;

  @ApiProperty({ example: "Sarah's Wedding" })
  @IsNotEmpty()
  @IsString()
  eventName: string;

  @ApiProperty({ enum: EventType, example: EventType.WEDDING })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({ example: '2025-06-15T00:00:00Z' })
  @IsDateString()
  eventDate: string;

  @ApiProperty({ example: '18:00' })
  @IsNotEmpty()
  @IsString()
  eventStartTime: string;

  @ApiProperty({ example: '23:00' })
  @IsNotEmpty()
  @IsString()
  eventEndTime: string;

  @ApiProperty({ example: 'Amman, Jordan', required: false })
  @IsOptional()
  @IsString()
  eventLocation?: string;

  @ApiProperty({ example: 200, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfGuests?: number;

  @ApiProperty({
    example: 'Arabic cuisine preferred. No nuts.',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiProperty({
    type: [BookingItemDto],
    example: [
      { subServiceId: 'uuid-1', quantity: 1 },
      { subServiceId: 'uuid-2', quantity: 50 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];
}