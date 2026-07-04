import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MinLength,
  NotContains,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Eventy@123456' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'Eventy@123456' })
  //@IsStrongPassword()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
