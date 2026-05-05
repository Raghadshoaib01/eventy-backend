import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { EventType } from '@prisma/client';
import { Type } from 'class-transformer';
import { TimeSlotDto } from './Complete service details.dto';

export class UpdateServiceDto {
  @ApiProperty({
    enum: EventType,
    isArray: true,
    required: false,
    example: [EventType.WEDDING, EventType.ENGAGEMENT],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes?: EventType[];

  @ApiProperty({ example: 'Updated description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  // ✅ مطابق Prisma
  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @IsString()
  workFromTime?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  workToTime?: string;

 
  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  hasSlots?: boolean;

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

  @ApiProperty({ type: [TimeSlotDto], required: false })
@IsOptional()
@ValidateNested({ each: true })
@Type(() => TimeSlotDto)
timeSlots?: TimeSlotDto[];
}