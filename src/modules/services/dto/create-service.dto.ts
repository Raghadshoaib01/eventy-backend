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
import { BadRequestException } from '@nestjs/common';

export class CreateServiceDto {
  // 
  @ApiProperty({ example: 'uuid-of-service-type' })
  @IsUUID()
  serviceTypeId: string;

  // 
  @ApiProperty({
    enum: EventType,
    isArray: true,
    example: [EventType.WEDDING, EventType.ENGAGEMENT],
  })
  @Transform(({ value }) => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }
  return value;
})
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes: EventType[];

  @ApiProperty({ example: 'Premium catering service', required: true, })
  @IsNotEmpty()
  @IsString()
  description?: string;

  @ApiProperty({ example: 50, required: false,
    description: 'For HALL/SOUND only required',
   })
   @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @ApiProperty({ example: 500, required: false,
    description: 'For HALL/SOUND only required',
   })
   @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @ApiProperty({ example: 2000, required: false,
    description: 'For HALL/SOUND only required',
   })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  price?: number;

  @ApiProperty({
    type: SubServiceDto,
    description: 'Single sub-service object',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    try {
    return plainToInstance(SubServiceDto, JSON.parse(value));
 } catch {
    throw new BadRequestException(
        'subService must be a valid JSON object',
      );
    }
  }  return value;
})
@ValidateNested()
@Type(() => SubServiceDto)
subService: SubServiceDto;

  
  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
  })
  businessFile?: any;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
  })
  serviceLogo?: any;
  
  // ✅ مهم جدًا: ملفات sub service
  @IsOptional()
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    isArray: true,
    description: 'Sub service media files',
  })
  @Transform(({ value }) => {
  if (value === 'string') return undefined;
  return value;
})
  subServiceMedia?: any[];

}