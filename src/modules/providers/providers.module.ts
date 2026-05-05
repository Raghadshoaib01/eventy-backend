import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ProviderAuthService } from './provider-auth.service';
import { ProviderAuthController } from './provider-auth.controller';
import { OtpService } from '../auth/otp.service';
import { ProviderProfileController } from './provider profail.controller';
import { ProviderProfileService } from './provider profail services.service';

@Module({
  controllers: [
    ProvidersController,
    ProviderAuthController,
    ProviderProfileController,
  ],
  providers: [ProviderAuthService, OtpService, ProviderProfileService],
})
export class ProvidersModule {}
