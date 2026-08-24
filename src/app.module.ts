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
import { ProviderAuthController } from './modules/providers/provider-auth.controller';
import { FirebaseModule } from './firebase/firebase.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ActionTrackingInterceptor } from './common/interceptors/action-tracking.interceptor';
import redisConfig from './config/redis.config';
import { DomainEventBus } from './common/events/domain-event-bus';
import { EventModule } from './modules/event/event.module';

import { PaymentsModule } from './modules/payments/payments.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { PackagesModule } from './modules/packages/packages.module';
import { SuggestedPackagesModule } from './modules/suggested-packages/suggested-packages.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BlockedSlotModule } from './modules/blocked-slots/blocked-slots.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      load: [redisConfig], 
     }),

    ScheduleModule.forRoot(),
    // Event-driven architecture bus
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 }, // 100 req/min افتراضي
    ]),

    // Firebase Admin SDK (global)
    FirebaseModule,

    // Database — PrismaService (@Global)
    DatabaseModule,

    // 3. CacheModule يوفر Redis لكل المشروع (للـ OTP)
   // 3. CacheModule يوفر Redis لكل المشروع (للـ OTP)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
      const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
      const isTls = url.startsWith('rediss://');

    return {
      store: await redisStore({
        url,
        family: 4,
        ...(isTls && { tls: { rejectUnauthorized: false } }),
      }),
    };
      }
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
    EventModule,

    PaymentsModule,
    DiscountsModule,
    FavoritesModule,
    ReviewsModule,
    ComplaintsModule,
    DeliveryModule,
    PackagesModule,
    SuggestedPackagesModule,
    BlockedSlotModule,
  ],
  controllers: [
    AppController,
    ProviderBookingsController,
    ProviderProfileController,
  ],
  providers: [
    AppService,
    ProviderBookingsService,
    ProviderProfileService,
    DomainEventBus,
    // Global interceptors registered via APP_INTERCEPTOR for DI support
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActionTrackingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

