import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

// ✅ مطابق Prisma 100%
export class TimeSlotDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Invalid time format. Use HH:mm',
  })
  fromTime: string; // ✅ FIX

  @ApiProperty({ example: '12:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Invalid time format. Use HH:mm',
  })
  toTime: string; // ✅ FIX

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  capacity: number;
}

// ⚠️ ملاحظة: capacity غير موجود في Prisma Availability → نحذفه
export class ServiceAvailabilityDto {
  @ApiProperty({ example: 'MONDAY', enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Invalid time format. Use HH:mm',
  })
  workFromTime: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Invalid time format. Use HH:mm',
  })
  workToTime: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  hasSlots?: boolean;

  @ApiProperty({ type: [TimeSlotDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  @IsOptional()
  timeSlots?: TimeSlotDto[];
}

// =======================
// WITHOUT price
// =======================
export class CompleteServiceDetailsDto {
  @ApiProperty({ example: 50, required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  minCapacity?: number;

  @ApiProperty({ example: 500, required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxCapacity?: number;

  @ApiProperty({
    type: [ServiceAvailabilityDto], // ✅ FIX (كان غلط)
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityDto)
  @IsNotEmpty()
  availability: ServiceAvailabilityDto[];
}

// =======================
// WITH price
// =======================
export class CompleteHallSoundDetailsDto {
  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  minCapacity: number;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  maxCapacity: number;

  @ApiProperty({ example: 2000.0 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty({
    type: [ServiceAvailabilityDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityDto)
  @IsNotEmpty()
  availability: ServiceAvailabilityDto[];
}