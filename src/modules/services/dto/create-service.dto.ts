import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType } from '@prisma/client';
import { EventType } from '@prisma/client';
import { CapacityUnit } from '@prisma/client';

class TimeSlotDto {
  @ApiProperty({ example: '09:00' })
  @IsNotEmpty()
  @IsString()
  startTime: string;

  @ApiProperty({ example: '12:00' })
  @IsNotEmpty()
  @IsString()
  endTime: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  capacity: number;
}

export class CreateServiceDto {
  @ApiProperty({ enum: ServiceType, example: ServiceType.FOOD })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({
    enum: EventType,
    isArray: true,
    example: [EventType.WEDDING, EventType.ENGAGEMENT],
  })
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes: EventType[];

  @ApiProperty({ example: 'Premium catering service', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  // Availability
  @ApiProperty({ example: '08:00' })
  @IsNotEmpty()
  @IsString()
  availableFrom: string;

  @ApiProperty({ example: '23:00' })
  @IsNotEmpty()
  @IsString()
  availableTo: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  dailyCapacity: number;

  @ApiProperty({ enum: CapacityUnit, example: CapacityUnit.BOOKING })
  @IsEnum(CapacityUnit)
  capacityUnit: CapacityUnit;

  // Optional: Time Slots
  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  useTimeSlots?: boolean;

  @ApiProperty({ type: [TimeSlotDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  timeSlots?: TimeSlotDto[];

  // For Halls/Sound
  @ApiProperty({ example: 50, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @ApiProperty({ example: 500, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @ApiProperty({ example: 2000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}