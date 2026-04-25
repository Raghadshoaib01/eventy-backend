import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { UsersModule } from '../users/users.module'; // ← أضف هذا
import { JwtStrategy } from './strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { RedisModule } from 'src/database/redis.module';

@Module({
  imports: [UsersModule, PassportModule,RedisModule],
  providers: [AuthService, OtpService, JwtStrategy, GoogleStrategy,CloudinaryService],
  controllers: [AuthController],
})
export class AuthModule {}
