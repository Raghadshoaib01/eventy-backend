import { Controller, Post } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('register')
  register() {}

  @Post('verify-otp')
  verifyOtp() {}

  @Post('resend-otp')
  resendOtp() {}

  @Post('reset-password/request')
  requestReset() {}

  @Post('reset-password/confirm')
  confirmReset() {}
}
