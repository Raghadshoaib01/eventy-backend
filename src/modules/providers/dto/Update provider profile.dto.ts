import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches, IsNumber } from 'class-validator';

export class UpdateProviderProfileDto {
  // ========== User Fields ==========
  @ApiProperty({ example: 'Ahmad Mohammad', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: '+962791234567', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'Invalid phone number' })
  phoneNumber?: string;

  // ========== Provider Fields ==========
  @ApiProperty({ example: 'Al-Noor Catering & Events', required: false })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({
    example: 'We provide premium catering services...',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  // ========== Location Update ==========
    @ApiProperty({ example: 'Amman, Jordan', required: false })
  @IsOptional()
  @IsString()
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


}

export class UpdateBankAccountDto {
  @ApiProperty({ example: 'JO00 0000 0000 0000 0000 0000 00' })
  @IsString()
  iban: string;

  @ApiProperty({ example: 'Arab Bank' })
  @IsString()
  bankName: string;

  @ApiProperty({ example: 'Ahmad Mohammad' })
  @IsString()
  accountHolderName: string;
}
