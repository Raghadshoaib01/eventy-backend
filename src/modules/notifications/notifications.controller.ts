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

@ApiTags('Notifications')
@ApiBearerAuth()
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
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.notificationsService.getUserNotifications(userId, pagination);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the unread notifications count for current user' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  // ─────────────────────────────────────────────────────────────
  // DEVICE TOKENS
  // ─────────────────────────────────────────────────────────────

  @Post('device-tokens')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  @ApiResponse({ status: 201, description: 'Device token saved successfully' })
  async saveDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveDeviceTokenDto,
  ) {
    await this.deviceTokenService.saveToken(userId, dto);
    return { message: 'Device token registered successfully', data: null };
  }

  @Delete('device-tokens/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a device token (e.g. on logout from specific device)' })
  @ApiParam({ name: 'token', description: 'The device token to remove' })
  @ApiResponse({ status: 200, description: 'Device token removed successfully' })
  async removeDeviceToken(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
  ) {
    await this.deviceTokenService.removeToken(userId, token);
    return { message: 'Device token removed successfully', data: null };
  }

  @Delete('device-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove all device tokens for current user (full logout)' })
  @ApiResponse({ status: 200, description: 'All device tokens removed' })
  async removeAllDeviceTokens(@CurrentUser('id') userId: string) {
    await this.deviceTokenService.removeAllTokens(userId);
    return { message: 'All device tokens removed successfully', data: null };
  }
}
