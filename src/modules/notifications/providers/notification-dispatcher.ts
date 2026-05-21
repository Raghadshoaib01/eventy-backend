// src/modules/notifications/providers/notification-dispatcher.ts

import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  DeliveryResult,
  NotificationPayload,
} from './notification-transport.interface';
import { NotificationDebugLogger } from './notification-debug-logger';

/**
 * NotificationDispatcher
 *
 * Replaces NotificationTransportFactory.
 *
 * Architecture:
 *  - Firebase: responsible for actual delivery (always attempted)
 *  - NotificationDebugLogger: observer (always runs, never affects result)
 *
 * This is a Composite pattern — NOT a factory.
 * Firebase runs first, result is passed to the logger, original result returned.
 *
 * NEVER throws — all errors are captured.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly debugLogger: NotificationDebugLogger,
  ) {}

  async dispatch(
    userId: string,
    tokens: string[],
    payload: NotificationPayload,
    notificationType: string,
  ): Promise<DeliveryResult> {
    let result: DeliveryResult;

    // ── Step 1: Attempt Firebase delivery (always) ─────────
    try {
      if (!this.firebaseService.isAvailable) {
        this.logger.warn(
          `[Dispatcher] Firebase not available for user ${userId}. ` +
          `Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.`,
        );
        result = {
          success: false,
          failedTokens: [],
          error: 'Firebase credentials not configured',
        };
      } else if (tokens.length === 0) {
        this.logger.debug(
          `[Dispatcher] No device tokens registered for user ${userId}.`,
        );
        result = { success: true, failedTokens: [] };
      } else {
        const fcmResult = await this.firebaseService.sendToDevices(tokens, payload);
        result = {
          success: fcmResult.success,
          failedTokens: fcmResult.invalidTokens,
          error: fcmResult.error,
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Dispatcher] Unexpected Firebase error: ${message}`);
      result = { success: false, failedTokens: [], error: message };
    }

    // ── Step 2: Debug logging (always, never affects result) ─
    try {
      this.debugLogger.log({
        userId,
        tokens,
        payload,
        notificationType,
        result,
      });
    } catch {
      // Observer failure must never affect the main flow
    }

    return result;
  }
}