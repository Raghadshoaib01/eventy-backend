// src/modules/notifications/device-token.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { SaveDeviceTokenDto } from './dto/save-device-token.dto';

/**
 * DeviceTokenService
 *
 * Manages per-user FCM/APNs device tokens.
 *
 * Design decisions:
 *  - Upsert on (userId, token) unique constraint → automatic deduplication.
 *  - Multiple tokens per user are fully supported (multi-device).
 *  - Invalid tokens returned by FCM are cleaned up automatically after push failure.
 */
@Injectable()
export class DeviceTokenService {
  private readonly logger = new Logger(DeviceTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a device token for a user.
   * Upsert ensures no duplicates. Updates platform and updatedAt on conflict.
   */
  async saveToken(userId: string, dto: SaveDeviceTokenDto): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: {
        userId_token: { userId, token: dto.token },
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        platform: dto.platform,
        updatedAt: new Date(),
      },
    });

    this.logger.debug(
      `[DeviceToken] Saved token for user ${userId} (${dto.platform}).`,
    );
  }

  /**
   * Remove a specific device token for a user.
   * Used when the user logs out from a specific device.
   */
  async removeToken(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token },
    });

    this.logger.debug(`[DeviceToken] Removed token for user ${userId}.`);
  }

  /**
   * Bulk-remove tokens reported as invalid by FCM.
   * Called automatically after a failed push delivery.
   */
  async removeInvalidTokens(userId: string, tokens: string[]): Promise<void> {
    if (!tokens.length) return;

    const { count } = await this.prisma.deviceToken.deleteMany({
      where: { userId, token: { in: tokens } },
    });

    this.logger.warn(
      `[DeviceToken] Cleaned up ${count} invalid token(s) for user ${userId}.`,
    );
  }

  /**
   * Remove all tokens for a user (e.g. on account deletion or full logout).
   */
  async removeAllTokens(userId: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { userId } });
    this.logger.debug(`[DeviceToken] Removed all tokens for user ${userId}.`);
  }

  /**
   * Fetch all active device tokens for a user.
   * Returns an empty array if the user has no registered devices.
   */
  async getUserTokens(userId: string): Promise<string[]> {
    const records = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
      orderBy: { updatedAt: 'desc' },
    });

    return records.map((r) => r.token);
  }
}
