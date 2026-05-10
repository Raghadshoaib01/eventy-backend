// src/modules/services/dto/Complete service details.dto.ts
import { ApiProperty  ,ApiPropertyOptional
} from '@nestjs/swagger';
import { Type, Transform, plainToInstance } from 'class-transformer';
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
  ArrayMinSize,
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

export class TimeSlotDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Invalid time format. Use HH:mm',
  })
  fromTime: string;

  @ApiProperty({ example: '12:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Invalid time format. Use HH:mm',
  })
  toTime: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  capacity: number;
}

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

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  capacity: number;

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

// DTO for Bank Account
export class BankAccountDto {
  @ApiProperty({ example: 'JO00 0000 0000 0000 0000 0000 00' })
  @IsString()
  @IsNotEmpty()
  iban: string;

  @ApiProperty({ example: 'Arab Bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ example: 'Ahmad Mohammad' })
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;
}

// ✅ DTO for SubService creation with required media
export class SubServiceDto{
  @ApiProperty({ example: 'Full Event Package' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Complete catering package for 100+ guests' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 25.5 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  pricePerUnit: number;

  @ApiProperty({
    example: 'ITEM',
    enum: ['ITEM', 'SESSION'],
    description: 'Unit type for pricing',
  })
  @IsEnum(['ITEM', 'SESSION'])
  @IsNotEmpty()
  unitType: string;

  @ApiProperty({ example: 5, required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  dailyCapacity?: number;
}

// For FOOD, PHOTOGRAPHY, FAVORS, DECORATION
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
    type: [ServiceAvailabilityDto],
    description: 'Availability schedule per day',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error('availability must be an array');
      }
      return plainToInstance(ServiceAvailabilityDto, parsed);
    }
    return value;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityDto)
  @IsNotEmpty()
  @ArrayMinSize(1)
  availability: ServiceAvailabilityDto[];

  // Bank Account (مطلوب)
  @ApiProperty({ type: BankAccountDto, description: 'Bank account details' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return plainToInstance(BankAccountDto, JSON.parse(value));
    }
    return value;
  })
  @ValidateNested()
  @Type(() => BankAccountDto)
  @IsNotEmpty()
  bankAccount: BankAccountDto;

  @ApiProperty({
    type: SubServiceDto,
    description: 'Single sub-service object',
  })
  @Transform(({ value }) => {
  if (typeof value === 'string') {
    return plainToInstance(SubServiceDto, JSON.parse(value));
  }
  return value;
})
@ValidateNested()
@Type(() => SubServiceDto)
subService: SubServiceDto;

// ✅ مهم جدًا: ملفات service
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    isArray: true,
    description: 'Main service media (1 or more files)',
  })
  serviceMedia?: any[];

  // ✅ مهم جدًا: ملفات sub service
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    isArray: true,
    description: 'Sub service media files',
  })
  subServiceMedia?: any[];

//     @ApiProperty({
//     type: 'array',
//     items: { type: 'string', format: 'binary' },
//     description: 'Media files for hall/sound (at least 1 required)',
//     required: true,
//   })
//   @IsNotEmpty({ message: 'At least one media file is required' })
// serviceMedia
//   ?: any[];

//     @ApiProperty({
//     type: 'array',
//     items: { type: 'string', format: 'binary' },
//     description: 'Media files for hall/sound (at least 1 required)',
//     required: true,
//   })
//   @IsNotEmpty({ message: 'At least one media file is required' })
//  subServiceMedia
//   ?: any[];
 }

// For HALL, SOUND
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
    description: 'Availability schedule per day',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error('availability must be an array');
      }
      return plainToInstance(ServiceAvailabilityDto, parsed);
    }
    return value;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityDto)
  @IsNotEmpty()
  availability: ServiceAvailabilityDto[];

  // Bank Account (مطلوب)
  @ApiProperty({ type: BankAccountDto, description: 'Bank account details' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return plainToInstance(BankAccountDto, JSON.parse(value));
    }
    return value;
  })
  @ValidateNested()
  @Type(() => BankAccountDto)
  @IsNotEmpty()
  bankAccount: BankAccountDto;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    isArray: true,
    description: 'Main service media (1 or more files)',
  })
  media
  ?: any[];
}