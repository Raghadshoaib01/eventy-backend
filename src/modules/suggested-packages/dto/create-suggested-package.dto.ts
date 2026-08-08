// src/modules/suggested-packages/dto/create-suggested-package.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSuggestedPackageDto {
  @ApiProperty({ example: 'Starter Wedding Bundle' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Suggested bundle of services for a wedding' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [String],
    description: 'Service IDs that compose this suggested package',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  serviceIds: string[];
}
