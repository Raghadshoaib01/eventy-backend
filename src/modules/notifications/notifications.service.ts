// src/modules/notifications/notifications.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, NotificationType } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { DeviceTokenService } from './device-token.service';
import { NotificationTransportFactory } from './providers/notification-transport.factory';

export interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/**
 * NotificationsService
 *
 * The single source of truth for the notification pipeline:
 *
 *  1. Persist notification to DB (deliveryStatus = PENDING)
 *  2. Fetch user's device tokens
 *  3. Delegate to the active transport provider
 *  4. Update deliveryStatus (SENT | FAILED)
 *  5. Clean up invalid tokens reported by FCM
 *
 * Push delivery is wrapped in try/catch — it NEVER fails the API response,
 * NEVER rolls back a transaction, and NEVER throws to a controller.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly transportFactory: NotificationTransportFactory,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CORE: create + deliver
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a DB notification record and attempt push delivery.
   * This is the ONLY entry point for the notification pipeline.
   * Always resolves — never throws.
   */
  async createAndDeliver(options: CreateNotificationOptions): Promise<void> {
    const { userId, type, title, body, metadata } = options;

    // 1. Persist notification
    let notificationId: string;
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          metadata: metadata as object | undefined,
          deliveryStatus: DeliveryStatus.PENDING,
        },
      });
      notificationId = notification.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[Notifications] Failed to persist notification for user ${userId}: ${msg}`,
      );
      return; // DB failure — abort silently
    }

    // 2. Attempt push delivery (non-blocking side-effect)
    try {
      const tokens = await this.deviceTokenService.getUserTokens(userId);
      const transport = this.transportFactory.resolve();

      const result = await transport.send(userId, tokens, { title, body }, type);

      const status = result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED;

      // 3. Update delivery status
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { deliveryStatus: status },
      });

      // 4. Clean up invalid tokens
      if (result.failedTokens?.length) {
        await this.deviceTokenService.removeInvalidTokens(
          userId,
          result.failedTokens,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[Notifications] Push delivery failed for user ${userId}: ${msg}. DB record kept.`,
      );

      // Mark as FAILED — do not re-throw
      try {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { deliveryStatus: DeliveryStatus.FAILED },
        });
      } catch {
        // secondary failure — ignore
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // READ: user notifications
  // ─────────────────────────────────────────────────────────────

  async getUserNotifications(userId: string, dto: PaginationDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = dto;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          isRead: true,
          deliveryStatus: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      message: 'Notifications retrieved successfully',
      data: {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          unreadCount,
        },
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return { message: 'Notification marked as read', data: null };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'All notifications marked as read', data: null };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { message: 'Unread count retrieved', data: { count } };
  }
}
