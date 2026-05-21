// src/modules/notifications/notifications.module.ts

import { Global, Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsListener } from './notifications.listener';
import { DeviceTokenService } from './device-token.service';
import { FirebaseNotificationProvider } from './providers/firebase-notification.provider';
import { NotificationDispatcher } from './providers/notification-dispatcher';
import { NotificationDebugLogger } from './providers/notification-debug-logger';

/**
 * NotificationsModule — @Global
 *
 * Exports NotificationsService so any feature module can inject it
 * without re-importing this module.
 *
 * EventEmitterModule is imported in AppModule; listeners are auto-discovered
 * by @nestjs/event-emitter when the Injectable is registered here.
 */
@Global()
@Module({
  imports: [FirebaseModule],
  controllers: [NotificationsController],
  providers: [
    // Core services
    NotificationsService,
    DeviceTokenService,
    NotificationsListener,
    FirebaseNotificationProvider,
    NotificationDebugLogger,
    NotificationDispatcher, 
  ],
  exports: [NotificationsService, DeviceTokenService],
})
export class NotificationsModule {}
