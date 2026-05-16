// src/modules/notifications/notifications.module.ts

import { Global, Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsListener } from './notifications.listener';
import { DeviceTokenService } from './device-token.service';
import { ConsoleNotificationProvider } from './providers/console-notification.provider';
import { FirebaseNotificationProvider } from './providers/firebase-notification.provider';
import { NotificationTransportFactory } from './providers/notification-transport.factory';

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

    // Event listener (auto-discovered by @nestjs/event-emitter)
    NotificationsListener,

    // Transport layer
    ConsoleNotificationProvider,
    FirebaseNotificationProvider,
    NotificationTransportFactory,
  ],
  exports: [NotificationsService, DeviceTokenService],
})
export class NotificationsModule {}
