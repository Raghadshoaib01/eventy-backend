import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    // 1. ConfigModule أول شيء — يحمّل .env ويجعله متاحاً في كل المشروع
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. DatabaseModule يوفر PrismaService لكل المشروع (@Global)
    DatabaseModule,

    // 3. CacheModule يوفر Redis لكل المشروع (للـ OTP)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
        }),
      }),
    }),

    // 4. Feature Modules
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}