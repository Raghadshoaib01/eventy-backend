import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((result) => ({
        success: true,
        statusCode: response.statusCode,
        message: result?.message ?? 'Success',
        data:
          result?.data !== undefined
            ? result.data
            : result?.message
              ? null
              : result,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
