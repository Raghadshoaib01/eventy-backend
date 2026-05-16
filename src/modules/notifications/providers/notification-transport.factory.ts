// src/modules/notifications/providers/notification-transport.factory.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from 'src/firebase/firebase.service';
import { ConsoleNotificationProvider } from './console-notification.provider';
import { FirebaseNotificationProvider } from './firebase-notification.provider';
import { NotificationTransportProvider } from './notification-transport.interface';

/**
 * NotificationTransportFactory
 *
 * Decides at runtime which transport to use:
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │ NODE_ENV !== 'production'  →  ConsoleNotificationProvider   │
 *  │ Firebase unavailable       →  ConsoleNotificationProvider   │
 *  │ production + Firebase OK   →  FirebaseNotificationProvider  │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * NotificationsService depends on this factory, never on concrete providers.
 */
@Injectable()
export class NotificationTransportFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly firebaseService: FirebaseService,
    private readonly consoleProvider: ConsoleNotificationProvider,
    private readonly firebaseProvider: FirebaseNotificationProvider,
  ) {}

  resolve(): NotificationTransportProvider {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    if (isProduction && this.firebaseService.isAvailable) {
      return this.firebaseProvider;
    }

    return this.consoleProvider;
  }
}
