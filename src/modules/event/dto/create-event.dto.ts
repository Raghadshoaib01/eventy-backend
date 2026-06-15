// src/modules/events/dto/create-event.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { EventType } from '@prisma/client';

export class BookingItemInputDto {
  @ApiProperty({ example: 'uuid-of-subservice' })
  @IsNotEmpty()
  @IsString()
  subServiceId: string;

  @ApiProperty({ example: 200 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'No nuts please' })
  @IsOptional()
  @IsString()
  customerNotes?: string;
}

export class ServiceSelectionDto {
  @ApiProperty({ example: 'uuid-of-service' })
  @IsNotEmpty()
  @IsString()
  serviceId: string;

  @ApiPropertyOptional({ example: 'uuid-of-timeslot' })
  @IsOptional()
  @IsString()
  timeSlotId?: string;

  @ApiProperty({
    type: [BookingItemInputDto],
 description:
      'HALL/SOUND → leave empty []. ' +
      'FOOD/PHOTOGRAPHY/FAVORS/DECORATION → at least 1 item required.',
      })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingItemInputDto)
  items: BookingItemInputDto[];
}

export class CreateEventDto {
  @ApiProperty({ example: "Sarah's Wedding" })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ enum: EventType, example: EventType.WEDDING ,description: 'WEDDING,ENGAGEMENT,BABY_SHOWER,GRADUATION,CONFERENCE,BIRTHDAY,ALL_EVENTS',})
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({ example: '2025-08-15T00:00:00Z' })
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

  @ApiPropertyOptional({ example: 'Amman, Jordan' })
  @IsOptional()
  @IsString()
  eventLocation?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfGuests?: number;

  @ApiPropertyOptional({ example: 'Arabic cuisine preferred.' })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiProperty({
    type: [ServiceSelectionDto],
    description: 'At least one service required',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceSelectionDto)
  services: ServiceSelectionDto[];
}