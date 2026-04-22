import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { AuthController } from './auth.controller';

@Module({
  providers: [AuthService, OtpService],
  controllers: [AuthController],
})
export class AuthModule {}
