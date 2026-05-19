import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs'; 
// 1. تحديد الملف المطلوب بناءً على البيئة
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env.development';
const envPath = path.resolve(process.cwd(), envFile);
let isFileLoaded = false;

// 2. الفحص الذكي: لو الملف موجود محلياً اقرأ منه، لو مش موجود (مثل Railway) اعتمد على السيرفر
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  isFileLoaded = true;
} else {
  // إذا لم يجد الملف (مثل وضع Railway)، سيعتمد مباشرة على بيئة السيرفر المباشرة
  dotenv.config(); 
}

import { Logger } from '@nestjs/common';
const startupLogger = new Logger('Bootstrap');
// طباعة توضيحية لمصدر الإعدادات
if (isFileLoaded) {
  startupLogger.log(`📄 Loaded variables from local file: ${envFile}`);
} else {
  startupLogger.log(`☁️ No local env file found. Using environment variables directly from the Server.`);
}
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { setupSwagger } from './config/swagger.config';
import { initCloudinary } from './config/cloudinary.config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  initCloudinary();
  const hasFirebase =
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY;

  if (!hasFirebase) {
    startupLogger.warn(
      '[Bootstrap] Firebase credentials not set. Push notifications will use console fallback.',
    );
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(app);
const port = process.env.PORT || process.env.APP_PORT || 3000;

  await app.listen(port);
  // console.log(`🚀 Server running on http://localhost:3000/api/v1`);
  // console.log(`📖 Swagger docs at http://localhost:3000/api/docs`);
  // console.log(`🚀 Server running on port ${process.env.PORT}`);
    // طباعة واضحة عند كل تشغيل
  startupLogger.log(`🌍 Environment : ${process.env.NODE_ENV}`);
  startupLogger.log(`📄 Env file    : ${envFile}`);
  startupLogger.log(`🗄️  Database    : ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? 'localhost'}`);
  startupLogger.log(`🔴 Redis       : ${process.env.REDIS_URL?.replace(/:\/\/.*@/, '://***@') ?? 'localhost:6379'}`);
  startupLogger.log(`🚀 Server      : http://localhost:${port}/api/v1`);
  startupLogger.log(`📖 Swagger     : http://localhost:${port}/api/docs`);
}
bootstrap();
