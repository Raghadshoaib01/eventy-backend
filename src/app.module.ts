import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { SharedModule } from './shared/shared.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ServicesModule } from './modules/services/services.module';
import { ProviderBookingsController } from './modules/bookings/provider-bookings.controller';
import { ProviderBookingsService } from './modules/bookings/provider-bookings.service';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ProviderProfileController } from './modules/providers/provider profail.controller';
// import { ServiceService } from './details/modules/services/services/service/service.service';
// import { ServiceService } from './details/modules/services/service/service.service';
// import { ServiceService } from './details/service/service.service';
// import { ServiceService } from './modules/services/service details.service';
import { ProviderProfileService } from './modules/providers/provider profail services.service';
// import { ProviderController } from './modules/providers/provider profail.controller';
import { AdminModule } from './modules/admin/admin.module';
import { AdminApprovalController } from './modules/admin/AdminApprovalController';
import { AdminApprovalService } from './modules/admin/admin-approval-service.service';
import { ProviderAuthController } from './modules/providers/provider-auth.controller';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. DatabaseModule يوفر PrismaService لكل المشروع (@Global)
    DatabaseModule,

    // 3. CacheModule يوفر Redis لكل المشروع (للـ OTP)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          url: process.env.REDIS_URL ,
        }),
      }),
    }),

    UsersModule,
    AuthModule,
    SharedModule,
    ProvidersModule,
    ServicesModule,
    ReportsModule,
    NotificationsModule,
    BookingsModule,
    AdminModule,
  ],
  controllers: [
    AppController,
    ProviderBookingsController,
    ProviderProfileController,
    AdminApprovalController,
   //ProviderController
  ],
  providers: [
    AppService,
    ProviderBookingsService,
    ProviderProfileService,
    AdminApprovalService
    ,
    
  ],
})
export class AppModule {}
