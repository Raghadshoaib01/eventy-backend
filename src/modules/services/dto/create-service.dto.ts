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
  IsNumber,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '@prisma/client';

class TimeSlotDto {
  // ✅ نفس Prisma
  @ApiProperty({ example: '09:00' })
  @IsNotEmpty()
  @IsString()
  fromTime: string;

  @ApiProperty({ example: '12:00' })
  @IsNotEmpty()
  @IsString()
  toTime: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  capacity: number;
}

export class CreateServiceDto {
  // ✅ UUID مطابق Prisma
  @ApiProperty({ example: 'uuid-of-service-type' })
  @IsUUID()
  serviceTypeId: string;

  // ✅ صحيح
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

  // ✅ نفس Prisma
  @ApiProperty({ example: '08:00' })
  @IsNotEmpty()
  @IsString()
  workFromTime: string;

  @ApiProperty({ example: '23:00' })
  @IsNotEmpty()
  @IsString()
  workToTime: string;

  // ⚠️ هذا ليس موجود مباشرة في Service → تستخدمه لاحقًا
  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  dailyCapacity: number;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  hasSlots?: boolean;

  @ApiProperty({ type: [TimeSlotDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  timeSlots?: TimeSlotDto[];

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