// src/modules/notifications/providers/notification-transport.interface.ts

/**
 * The normalised payload sent by any notification transport.
 * `data` values must all be strings (FCM requirement).
 */
export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Result returned by every transport provider.
 * `failedTokens` lists device tokens that should be cleaned up.
 */
export interface DeliveryResult {
  success: boolean;
  failedTokens?: string[];
  error?: string;
}

/**
 * Transport abstraction — any concrete provider must implement this.
 * Consumers (NotificationsService) depend ONLY on this interface,
 * never on Firebase or console directly.
 */
export interface NotificationTransportProvider {
  /**
   * Attempt delivery to one or more device tokens.
   * Implementations MUST NOT throw — all errors are captured in DeliveryResult.
   */
  send(
    userId: string,
    tokens: string[],
    payload: NotificationPayload,
    notificationType: string,
  ): Promise<DeliveryResult>;
}

export const NOTIFICATION_TRANSPORT = Symbol('NOTIFICATION_TRANSPORT');
