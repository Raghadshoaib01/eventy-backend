// src/modules/notifications/notifications.controller.ts

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { NotificationsService } from './notifications.service';
import { DeviceTokenService } from './device-token.service';
import { SaveDeviceTokenDto } from './dto/save-device-token.dto';
import { NotificationType } from '@prisma/client';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deviceTokenService: DeviceTokenService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get paginated list of notifications for current user' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  getUserNotifications(
    @Req() req,
    @Query() pagination: PaginationDto,
  ) {
    return this.notificationsService.getUserNotifications(req.user?.sub, pagination);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the unread notifications count for current user' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  getUnreadCount(@CurrentUser('sub') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(
    @Req() req,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(req.user?.sub, notificationId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllAsRead(@Req() req) {
    return this.notificationsService.markAllAsRead(req.user?.sub);
  }

  // ─────────────────────────────────────────────────────────────
  // DEVICE TOKENS
  // ─────────────────────────────────────────────────────────────

  @Post('device-tokens')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  @ApiResponse({ status: 201, description: 'Device token saved successfully' })
  async saveDeviceToken(
    @Req() req,
    @Body() dto: SaveDeviceTokenDto,
  ) {
    await this.deviceTokenService.saveToken(req.user?.sub, dto);
    return { message: 'Device token registered successfully', data: null };
  }

  @Delete('device-tokens/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a device token (e.g. on logout from specific device)' })
  @ApiParam({ name: 'token', description: 'The device token to remove' })
  @ApiResponse({ status: 200, description: 'Device token removed successfully' })
  async removeDeviceToken(
    @Req() req,
    @Param('token') token: string,
  ) {
    await this.deviceTokenService.removeToken(req.user?.sub, token);
    return { message: 'Device token removed successfully', data: null };
  }

  @Delete('device-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove all device tokens for current user (full logout)' })
  @ApiResponse({ status: 200, description: 'All device tokens removed' })
  async removeAllDeviceTokens(@CurrentUser('sub') userId: string) {
    await this.deviceTokenService.removeAllTokens(userId);
    return { message: 'All device tokens removed successfully', data: null };
  }
  ////////////////////////test notification 
  // src/modules/notifications/notifications.controller.ts
  // أضف في نهاية الـ controller

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test push notification for current user (dev only)' })
  @ApiResponse({ status: 200, description: 'Test notification sent' })
  async testNotification(@CurrentUser('sub') userId: string) {
    await this.notificationsService.createAndDeliver({
      userId,
      type: NotificationType.GENERAL,
      title: 'Test Notification 🔔',
      body: 'If you see this on your device, push is working!',
      metadata: { screen: 'profile', targetUserId: userId, source: 'manual-test' },
    });

    return { message: 'Test notification triggered', data: null };
  }
}
