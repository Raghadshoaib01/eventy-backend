// src/modules/packages/dto/book-package.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '@prisma/client';
import { IsTodayOrFuture } from 'src/common/validators/future-date.validator';
import {ServiceSelectionDto } from 'src/modules/event/dto/create-event.dto';

export class BookPackageDto {
  @ApiProperty({ example: "Sarah's Wedding" })
  @IsString()
  name: string;

  @ApiProperty({ enum: EventType, example: EventType.WEDDING })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({ example: '2026-08-25T00:00:00Z' })
  @IsDateString()
  @IsTodayOrFuture({ message: 'Event date cannot be in the past' })
  eventDate: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  eventStartTime: string;

  @ApiProperty({ example: '23:00' })
  @IsString()
  eventEndTime: string;

  @ApiPropertyOptional({ example: 'Amman, Jordan' })
  @IsOptional()
  @IsString()
  eventLocation?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfGuests?: number;

  @ApiPropertyOptional({ example: 'Arabic cuisine preferred.' })
  @IsOptional()
  @IsString()
  customerNotes?: string;

 @ApiProperty({
    type: [ServiceSelectionDto],
    description:
      'One selection per ACTIVE package service — the set of serviceId values must exactly ' +
      'match this package\'s currently active services (no partial booking, no extras). ' +
      'HALL/SOUND services must send items: [] ; FOOD/PHOTOGRAPHY/FAVORS/DECORATION must ' +
      'send at least one sub-service item with a quantity.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceSelectionDto)
  services: ServiceSelectionDto[];

  @ApiPropertyOptional({
    example: 'do not send any code across the system',
    description: 'do not send any code across the system',
  })
  @IsOptional()
  @IsString()
  discountCode?: string;
}
