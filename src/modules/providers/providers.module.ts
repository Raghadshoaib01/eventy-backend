import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ProviderAuthService } from './provider-auth.service';
import { ProviderAuthController } from './provider-auth.controller';
import { OtpService } from '../auth/otp.service';

@Module({
  
  controllers: [ProvidersController, ProviderAuthController],
   providers: [ProviderAuthService],
})
export class ProvidersModule {}
