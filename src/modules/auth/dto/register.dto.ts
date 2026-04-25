import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsStrongPassword,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Sarah Ahmed' })  
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'sarah@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'Invalid phone number' })
  phoneNumber: string;

  @ApiProperty({ example: '********' })
  //@IsStrongPassword()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @IsOptional()
  address?: string;
}
