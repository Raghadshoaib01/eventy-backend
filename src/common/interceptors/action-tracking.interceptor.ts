// src/common/interceptors/action-tracking.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from 'src/database/prisma.service';
import { AUDIT_KEY, AuditOptions } from '../decorators/audit.decorator';
import { TRACK_ACTION_KEY, TrackActionOptions } from '../decorators/track-action.decorator';

/**
 * ActionTrackingInterceptor
 *
 * A globally-registered DI-aware interceptor (via APP_INTERCEPTOR) that:
 *
 *  BEFORE handler:
 *   - Records start timestamp.
 *
 *  AFTER SUCCESS:
 *   - Reads @TrackAction() metadata → emits domain event via EventEmitter2.
 *   - Reads @Audit() metadata → persists AuditLog entry to database.
 *
 *  AFTER FAILURE:
 *   - Logs error with full context (method, route, actor, elapsed time).
 *
 * Design rules:
 *  - NEVER throws to the controller.
 *  - All side-effects (audit, event emit) are fire-and-forget.
 *  - Events are emitted AFTER the response is committed (tap afterSuccess).
 */
@Injectable()
export class ActionTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActionTrackingInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<
      Request & { user?: { id?: string; role?: string } }
    >();

    const { method, url, ip } = request;
    const actorId = request.user?.id ?? null;

    return next.handle().pipe(
      tap({
        next: (responseData: unknown) => {
          const elapsed = Date.now() - startTime;

          // ── Emit domain event (from @TrackAction) ──────────────────
          const trackOptions = this.reflector.get<TrackActionOptions>(
            TRACK_ACTION_KEY,
            context.getHandler(),
          );

          if (trackOptions?.notify) {
            const entityId = this.extractEntityId(
              responseData,
              trackOptions.entityIdPath,
            );

            setImmediate(() => {
              try {
                this.eventEmitter.emit(trackOptions.notify!, {
                  actorId,
                  entityId,
                  metadata: { method, url, elapsed },
                });
              } catch (err) {
                this.logger.warn(
                  `[ActionTracking] Failed to emit event ${trackOptions.notify}: ${(err as Error).message}`,
                );
              }
            });
          }

          // ── Persist audit log (from @Audit) ───────────────────────
          const auditOptions = this.reflector.get<AuditOptions>(
            AUDIT_KEY,
            context.getHandler(),
          );

          if (auditOptions) {
            const entityId = this.extractEntityId(
              responseData,
              auditOptions.entityIdKey,
            );

            setImmediate(async () => {
              try {
                await this.prisma.auditLog.create({
                  data: {
                    action: auditOptions.action,
                    entity: auditOptions.entity,
                    entityId: entityId ?? undefined,
                    newValue: (responseData as object) ?? undefined,
                    userId: actorId ?? undefined,
                    ipAddress: ip,
                    userAgent: request.headers['user-agent'],
                  },
                });
              } catch (err) {
                this.logger.warn(
                  `[ActionTracking] Failed to write audit log for ${auditOptions.entity}: ${(err as Error).message}`,
                );
              }
            });
          }
        },

        error: (err: unknown) => {
          const elapsed = Date.now() - startTime;
          const status = (err as { status?: number })?.status ?? 500;
          this.logger.error(
            `[ActionTracking] FAILED ${method} ${url} — status:${status} elapsed:${elapsed}ms actor:${actorId} — ${(err as Error)?.message}`,
          );
        },
      }),
    );
  }

  private extractEntityId(
    data: unknown,
    keyPath?: string,
  ): string | null {
    if (!data || typeof data !== 'object') return null;

    const target = (data as Record<string, unknown>)?.['data'] ?? data;
    if (!target || typeof target !== 'object') return null;

    const key = keyPath ?? 'id';
    const value = (target as Record<string, unknown>)[key];

    return typeof value === 'string' ? value : null;
  }
}
