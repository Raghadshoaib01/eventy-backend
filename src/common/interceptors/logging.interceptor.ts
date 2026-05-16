// src/common/interceptors/logging.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

/**
 * LoggingInterceptor
 *
 * Logs every HTTP request with:
 *  - HTTP method
 *  - Request path
 *  - Response status code
 *  - Total execution time in ms
 *  - Authenticated user ID (if present)
 *
 * Registered globally via APP_INTERCEPTOR in AppModule (DI-aware).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id?: string } }>();
    const response = http.getResponse<Response>();

    const { method, url } = request;
    const userId = request.user?.id ?? 'anonymous';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - startTime;
          const statusCode = response.statusCode;
          this.logger.log(
            `${method} ${url} ${statusCode} +${elapsed}ms [user:${userId}]`,
          );
        },
        error: (err: unknown) => {
          const elapsed = Date.now() - startTime;
          const status = (err as { status?: number })?.status ?? 500;
          this.logger.error(
            `${method} ${url} ${status} +${elapsed}ms [user:${userId}] — ${(err as Error)?.message}`,
          );
        },
      }),
    );
  }
}
