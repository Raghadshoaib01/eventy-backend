// src/modules/notifications/providers/firebase-notification.provider.ts

import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  DeliveryResult,
  NotificationPayload,
  NotificationTransportProvider,
} from './notification-transport.interface';

/**
 * FirebaseNotificationProvider
 *
 * Active in production when Firebase credentials are fully configured.
 * Delegates to FirebaseService for actual FCM delivery.
 * NEVER throws — all errors are captured and returned in DeliveryResult.
 */
@Injectable()
export class FirebaseNotificationProvider
  implements NotificationTransportProvider
{
  private readonly logger = new Logger(FirebaseNotificationProvider.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  async send(
    userId: string,
    tokens: string[],
    payload: NotificationPayload,
    notificationType: string,
  ): Promise<DeliveryResult> {
    if (!this.firebaseService.isAvailable) {
      this.logger.warn(
        `[Firebase] Service unavailable, skipping push for user ${userId}`,
      );
      return { success: false, failedTokens: [], error: 'Firebase unavailable' };
    }

    if (!tokens.length) {
      this.logger.debug(
        `[Firebase] No device tokens for user ${userId}, skipping push.`,
      );
      return { success: true, failedTokens: [] };
    }

    this.logger.debug(
      `[Firebase] Sending ${notificationType} to user ${userId} on ${tokens.length} device(s).`,
    );

    const result = await this.firebaseService.sendToDevices(tokens, {
      title: payload.title,
      body: payload.body,
      data: {
        ...payload.data,
        notificationType,
        userId,
      },
    });

    return {
      success: result.success,
      failedTokens: result.invalidTokens,
      error: result.error,
    };
  }
}
