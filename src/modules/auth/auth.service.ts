import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ConfirmResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {

    constructor(
        private readonly usersService: UsersService,
        private readonly otpService: OtpService,
    ) {}
    // signup → ينشئ مستخدم ويرسل OTP
async signup(dto: RegisterDto) {
  // 1. تحقق ما في إيميل مكرر
  // 2. hash الباسورد
  // 3. create User في Prisma (isVerified: false)
  // 4. this.otpService.sendOtp(dto.email)
}

// verifyOtp → يفعّل الحساب
async verifyOtp(dto: VerifyOtpDto) {
  // 1. this.otpService.verifyOtp(email, code)
  // 2. update User: isVerified = true
  // 3. return generateTokens(user)
}

// resendOtp → يرسل كود جديد
async resendOtp(dto: ResendOtpDto) {
  // 1. this.otpService.deleteOtp(email)   ← يمسح القديم
  // 2. this.otpService.sendOtp(email)     ← يرسل جديد
}

// requestReset → نسيان الباسورد
async requestReset(email: string) {
  // 1. تحقق المستخدم موجود
  // 2. this.otpService.sendOtp(email)
}

// confirmReset → تأكيد + باسورد جديد
async confirmReset(dto: ConfirmResetPasswordDto) {
  // 1. this.otpService.verifyOtp(email, code)
  // 2. hash newPassword
  // 3. update User في Prisma
}
}
