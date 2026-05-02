import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

enum UnitType {
  BOOKING = 'BOOKING',
  ITEM = 'ITEM',
  SESSION = 'SESSION',
  PERSON = 'PERSON',
}

export class CreateSubServiceDto {
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
    example: 'PERSON',
    enum: UnitType,
    description: 'Unit type for pricing'
  })
  @IsEnum(UnitType)
  @IsNotEmpty()
  unitType: UnitType;

  @ApiProperty({ example: 5, required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  dailyCapacity?: number;
}