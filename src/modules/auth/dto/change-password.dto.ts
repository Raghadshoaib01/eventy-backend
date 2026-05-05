import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MinLength,
  NotContains,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: '********' })
  @IsStrongPassword()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
