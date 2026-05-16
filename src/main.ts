import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { setupSwagger } from './config/swagger.config';
import { initCloudinary } from './config/cloudinary.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  initCloudinary();

  // ── Firebase credential check (soft — console fallback activates if missing)
  const hasFirebase =
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY;

  if (!hasFirebase) {
    logger.warn(
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

  // TransformInterceptor must remain as useGlobalInterceptors (no DI needed)
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  setupSwagger(app);

  await app.listen(3000);
  logger.log('🚀 Server running on http://localhost:3000/api/v1');
  logger.log('📖 Swagger docs at http://localhost:3000/api/docs');
}

bootstrap();

