import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateBusinessInfoDto {
  @ApiProperty({example: 'BIMAS HALL',required: true,})
  @IsNotEmpty()
  @IsString()
  businessName: string;

  @ApiProperty({ example: 'CR-BIMAS-20251001', required: true })
  @IsNotEmpty()
  @IsString()
  businessLicense: string;

  @ApiProperty({ example: 'BIMAS HALL for all your events', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}