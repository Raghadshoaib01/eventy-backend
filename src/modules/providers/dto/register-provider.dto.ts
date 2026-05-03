import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  IsNumber,
  IsArray,
  IsEnum,
} from 'class-validator';

enum EventType {
  WEDDING = 'WEDDING',
  ENGAGEMENT = 'ENGAGEMENT',
  BABY_SHOWER = 'BABY_SHOWER',
  GRADUATION = 'GRADUATION',
  CONFERENCE = 'CONFERENCE',
  BIRTHDAY = 'BIRTHDAY',
  ALL_EVENTS = 'ALL_EVENTS',
}

enum ServiceType {
  FOOD = 'FOOD',
  PHOTOGRAPHY = 'PHOTOGRAPHY',
  FAVORS = 'FAVORS',
  DECORATION = 'DECORATION',
  HALL = 'HALL',
  SOUND = 'SOUND',
}

export class RegisterProviderDto {
  // ========== STEP 1: Account Info ==========
  @ApiProperty({ example: 'Ahmad Mohammad' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'ahmad@alnoor.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+962791234567' })
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'Invalid phone number' })
  phoneNumber: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @MinLength(8)
  password: string;

  // ========== STEP 2: Business Info + Location ==========
  @ApiProperty({ example: 'Al-Noor Catering' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: 'CR-12345678' })
  @IsString()
  @IsNotEmpty()
  businessLicense: string;

  @ApiProperty({ example: 'Amman, Jordan', required: false })
  @IsString()
  @IsOptional()
  locationName?: string;
  
  @ApiProperty({ example: 31.9539, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;
  
  @ApiProperty({ example: 35.9106, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  // ========== STEP 3: Initial Service Info (معلومات أولية فقط) ==========
  @ApiProperty({ 
    example: 'FOOD',
    enum: ServiceType,
    description: 'Service type - determines approval workflow'
  })
 // @IsEnum(['FOOD', 'PHOTOGRAPHY', 'FAVORS', 'DECORATION', 'HALL', 'SOUND'])
  @IsNotEmpty()
serviceTypeId: string;

  @ApiProperty({ 
    example: ['WEDDING', 'ENGAGEMENT', 'BIRTHDAY'],
    enum: EventType,
    isArray: true
  })
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes: EventType[];

  @ApiProperty({ 
    example: 'Premium Arabic and international catering for all events.'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  // For HALL/SOUND only - يتم إرسالها في التسجيل
  @ApiProperty({ example: 50, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minCapacity?: number;

  @ApiProperty({ example: 500, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxCapacity?: number;

  @ApiProperty({ example: 2000, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  price?: number;
}