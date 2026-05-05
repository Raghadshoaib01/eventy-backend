import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateBankAccountDto {
  @ApiProperty({
    example: 'JO00 0000 0000 0000 0000 0000 00',
    required: false,
  })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiProperty({ example: 'Arab Bank', required: false })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ example: 'Ahmad Mohammad', required: false })
  @IsOptional()
  @IsString()
  accountHolderName?: string;
}