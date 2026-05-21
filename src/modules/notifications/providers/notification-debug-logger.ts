// src/modules/notifications/providers/notification-debug-logger.ts

import { Injectable, Logger } from '@nestjs/common';
import { DeliveryResult, NotificationPayload } from './notification-transport.interface';

/**
 * NotificationDebugLogger
 *
 * Observer layer — runs after every delivery attempt.
 * NEVER affects success/failure.
 * NEVER throws.
 * Purpose: debugging, observability, integration testing.
 */
@Injectable()
export class NotificationDebugLogger {
  private readonly logger = new Logger('NotificationDebug');

  log(options: {
    userId: string;
    tokens: string[];
    payload: NotificationPayload;
    notificationType: string;
    result: DeliveryResult;
  }): void {
    const { userId, tokens, payload, notificationType, result } = options;

    const status = result.success ? '✅ SENT' : '❌ FAILED';
    const failedCount = result.failedTokens?.length ?? 0;

    this.logger.debug(`
╔══════════════════════════════════════════════════════╗
║          [Notification Debug Logger]                 ║
╠══════════════════════════════════════════════════════╣
║ Status         : ${status.padEnd(35)}
║ Type           : ${notificationType.substring(0, 35).padEnd(35)}
║ Target User    : ${userId.substring(0, 35).padEnd(35)}
║ Tokens Count   : ${String(tokens.length).padEnd(35)}
║ Failed Tokens  : ${String(failedCount).padEnd(35)}
║ Title          : ${payload.title.substring(0, 35).padEnd(35)}
║ Body           : ${payload.body.substring(0, 35).padEnd(35)}
${result.error ? `║ Error          : ${result.error.substring(0, 35).padEnd(35)}\n` : ''}╚══════════════════════════════════════════════════════╝`);
  }
}