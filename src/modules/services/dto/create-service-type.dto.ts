// src/modules/services/dto/create-service-type.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateServiceTypeDto {
  @ApiProperty({ example: 'CATERING' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Catering and food services', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}