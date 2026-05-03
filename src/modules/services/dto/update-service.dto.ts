import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
// import { CapacityUnit } from '@prisma/client';

enum EventType {
  WEDDING = 'WEDDING',
  ENGAGEMENT = 'ENGAGEMENT',
  BABY_SHOWER = 'BABY_SHOWER',
  GRADUATION = 'GRADUATION',
  CONFERENCE = 'CONFERENCE',
  BIRTHDAY = 'BIRTHDAY',
  ALL_EVENTS = 'ALL_EVENTS',
}

export class UpdateServiceDto {
  @ApiProperty({ 
    example: ['WEDDING', 'ENGAGEMENT'],
    enum: EventType,
    isArray: true,
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes?: EventType[];

  @ApiProperty({ 
    example: 'Updated description',
    required: false
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 500, required: false })
  @IsOptional()
  @IsNumber()
  maxQuantity?: number;

  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @IsString()
  availableFrom?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  availableTo?: string;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  dailyCapacity?: number;

  @ApiProperty({ 
    example: 'BOOKING',
    enum: ['BOOKING', 'ITEM', 'SESSION'],
    required: false
  })

  // @IsOptional()
  // @IsEnum(CapacityUnit)
  // capacityUnit?: CapacityUnit;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  useTimeSlots?: boolean;

  @ApiProperty({ example: 50, required: false })
  @IsOptional()
  @IsNumber()
  minCapacity?: number;

  @ApiProperty({ example: 500, required: false })
  @IsOptional()
  @IsNumber()
  maxCapacity?: number;

  @ApiProperty({ example: 2000, required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isClosedToday?: boolean;
}