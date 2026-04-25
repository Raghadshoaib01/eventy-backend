import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsStrongPassword } from 'class-validator';

// المرحلة الأولى: POST /auth/reset-password/request
export class RequestResetPasswordDto {
  @ApiProperty({ example: 'sarah@example.com' })
  @IsEmail()
  email: string;
}
import { IsString, Length, MinLength } from 'class-validator';

// المرحلة الثانية: POST /auth/reset-password/confirm
export class ConfirmResetPasswordDto {
  @ApiProperty({ example: 'sarah@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({ example: '********' })
  @IsStrongPassword()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
