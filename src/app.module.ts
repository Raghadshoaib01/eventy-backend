import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { ProviderProfileService } from './modules/providers/provider profail services.service';
import { AdminModule } from './modules/admin/admin.module';
import { AdminApprovalController } from './modules/admin/AdminApprovalController';
import { AdminApprovalService } from './modules/admin/admin-approval-service.service';
import { ProviderAuthController } from './modules/providers/provider-auth.controller';
import { FirebaseModule } from './firebase/firebase.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ActionTrackingInterceptor } from './common/interceptors/action-tracking.interceptor';

@Module({
  imports: [
    // Configuration (global)
    ConfigModule.forRoot({ isGlobal: true }),

    // Event-driven architecture bus
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),

    // Firebase Admin SDK (global)
    FirebaseModule,

    // Database — PrismaService (@Global)
    DatabaseModule,

    // Redis Cache (@Global)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          url: process.env.REDIS_URL ?? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        }),
      }),
    }),

    // Feature modules
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
  ],
  providers: [
    AppService,
    ProviderBookingsService,
    ProviderProfileService,
    AdminApprovalService,

    // Global interceptors registered via APP_INTERCEPTOR for DI support
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActionTrackingInterceptor,
    },
  ],
})
export class AppModule {}

