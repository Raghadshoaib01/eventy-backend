// src/firebase/firebase.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FcmSendResult {
  success: boolean;
  /** Tokens that returned invalid/unregistered errors — should be cleaned up */
  invalidTokens: string[];
  error?: string;
}

/**
 * FirebaseService — wraps Firebase Admin SDK.
 *
 * If credentials are missing or invalid the service marks itself
 * unavailable (`isAvailable = false`). All callers must check this flag
 * before attempting delivery; no exception is thrown at bootstrap.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;
  private _isAvailable = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        '[Firebase] Credentials missing — push notifications will use console fallback.',
      );
      return;
    }

    try {
      // Avoid re-initialising if already initialised (e.g. hot-reload)
      this.app =
        admin.apps.find((a) => a?.name === 'eventy') ??
        admin.initializeApp(
          {
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          },
          'eventy',
        );

      this._isAvailable = true;
      this.logger.log('[Firebase] Admin SDK initialised successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Firebase] Initialisation failed: ${message}`);
    }
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  /**
   * Send a push notification to one or more device tokens.
   * Never throws — all errors are captured and returned in the result object.
   */
  async sendToDevices(
    tokens: string[],
    payload: FcmPayload,
  ): Promise<FcmSendResult> {
    if (!this._isAvailable || !this.app) {
      return {
        success: false,
        invalidTokens: [],
        error: 'Firebase not available',
      };
    }

    if (!tokens.length) {
      return { success: true, invalidTokens: [] };
    }

    try {
      const messaging = this.app.messaging();
      const invalidTokens: string[] = [];

      if (tokens.length === 1) {
        const response = await messaging.send({
          token: tokens[0],
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
        this.logger.debug(`[Firebase] Message sent: ${response}`);
      } else {
        const response = await messaging.sendEachForMulticast({
          tokens,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });

        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        this.logger.debug(
          `[Firebase] Multicast: ${response.successCount} sent, ${response.failureCount} failed.`,
        );
      }

      return { success: true, invalidTokens };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Firebase] Send failed: ${message}`);
      return { success: false, invalidTokens: [], error: message };
    }
  }
}
