import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { plainToInstance, Transform, Type } from 'class-transformer';
import { EventType } from '@prisma/client';
import { ServiceAvailabilityDto, SubServiceDto } from './Complete service details.dto';

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

  @ApiProperty({
  type: [ServiceAvailabilityDto],
  description: 'Availability schedule per day',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityDto)
  availability: ServiceAvailabilityDto[];

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

  // src/modules/services/dto/Complete service details.dto.ts

// أضيفي في نهاية CompleteServiceDetailsDto وCompleteHallSoundDetailsDto:
@ApiPropertyOptional({ example: 'Amman, Jordan' })
@IsOptional()
@IsString()
locationName?: string;

@ApiPropertyOptional({ example: 31.9539 })
@IsOptional()
@Type(() => Number)
@IsNumber()
latitude?: number;

@ApiPropertyOptional({ example: 35.9106 })
@IsOptional()
@Type(() => Number)
@IsNumber()
longitude?: number;


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

}