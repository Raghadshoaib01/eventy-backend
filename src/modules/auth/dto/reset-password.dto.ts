import { IsEmail } from 'class-validator';

// المرحلة الأولى: POST /auth/reset-password/request
export class RequestResetPasswordDto {
  @IsEmail()
  email: string;
}
import { IsString, Length, MinLength } from 'class-validator';

// المرحلة الثانية: POST /auth/reset-password/confirm
export class ConfirmResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}