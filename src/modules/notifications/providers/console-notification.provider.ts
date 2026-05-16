// src/modules/notifications/providers/console-notification.provider.ts

import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryResult,
  NotificationPayload,
  NotificationTransportProvider,
} from './notification-transport.interface';

/**
 * ConsoleNotificationProvider
 *
 * Active when:
 *  - NODE_ENV !== 'production', OR
 *  - Firebase credentials are not configured.
 *
 * Prints the notification details to the terminal in a structured format.
 * Always returns { success: false } to signal that no actual push was sent,
 * which causes the caller to mark deliveryStatus as FAILED — indicating the
 * pipeline executed correctly but the external provider is not configured.
 *
 * Per AGENT_RULES: this is the expected dev/fallback behaviour.
 */
@Injectable()
export class ConsoleNotificationProvider
  implements NotificationTransportProvider
{
  private readonly logger = new Logger('NotificationFallback');

  async send(
    userId: string,
    tokens: string[],
    payload: NotificationPayload,
    notificationType: string,
  ): Promise<DeliveryResult> {
    this.logger.warn(`
╔══════════════════════════════════════════════════════╗
║            [Notification Fallback]                   ║
╠══════════════════════════════════════════════════════╣
║ Status  : FAILED_TO_SEND                             
║ Reason  : Missing Firebase credentials               
╠══════════════════════════════════════════════════════╣
║ Notification Type : ${notificationType.padEnd(33)}
║ Target User       : ${userId.padEnd(33)}
║ Device Tokens     : ${(tokens.length || 0).toString().padEnd(33)}
║ Title             : ${payload.title.substring(0, 33).padEnd(33)}
║ Message           : ${payload.body.substring(0, 33).padEnd(33)}
╚══════════════════════════════════════════════════════╝`);

    return {
      success: false,
      failedTokens: [],
      error: 'Missing Firebase credentials',
    };
  }
}
