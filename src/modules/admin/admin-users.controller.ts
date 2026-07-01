import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AdminUseresService } from './admin-useres.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { GetAllBookingsDto } from './dto/get-all-bookings.dto';
import { BlockAccountDto } from './dto/block-account.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Audit } from 'src/common/decorators/audit.decorator';
import { AuditAction, UserRole } from '@prisma/client';

@ApiTags('Admin Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin-users')
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUseresService,
  ) {}

  @Get('providers/pending')
  @ApiOperation({
    summary: 'Get pending provider applications',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending providers retrieved successfully',
  })
  getPendingProviders(
    @Query() paginationDto: PaginationDto,
  ) {
    return this.adminUsersService.getPendingProviders(
      paginationDto,
    );
  }

  @Get('providers/:providerId')
  @ApiOperation({
    summary: 'Get provider details',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider details retrieved successfully',
  })
  getProviderDetails(
    @Param('providerId') providerId: string,
  ) {
    return this.adminUsersService.getProviderDetails(
      providerId,
    );
  }

  @Get('bookings')
  @ApiOperation({
    summary: 'Get all bookings with filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookings retrieved successfully',
  })
  getAllBookings(
    @Query() filters: GetAllBookingsDto,
  ) {
    return this.adminUsersService.getAllBookings(filters);
  }

  // ─────────────────────────────────────────────────────────────
  // BLOCK / UNBLOCK — User
  // ─────────────────────────────────────────────────────────────

  @Patch('users/:userId/block')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BLOCK, entity: 'User', entityIdKey: 'userId' })
  @ApiOperation({ summary: 'Block a user account' })
  @ApiResponse({ status: 200, description: 'User blocked successfully' })
  @ApiResponse({ status: 400, description: 'User already blocked or has an active engagement' })
  @ApiResponse({ status: 404, description: 'User not found' })
  blockUser(
    @Request() req,
    @Param('userId') userId: string,
    @Body() dto: BlockAccountDto,
  ) {
    return this.adminUsersService.blockUser(req.user.sub, userId, dto.reason);
  }

  @Patch('users/:userId/unblock')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UNBLOCK, entity: 'User', entityIdKey: 'userId' })
  @ApiOperation({ summary: 'Unblock a user account' })
  @ApiResponse({ status: 200, description: 'User unblocked successfully' })
  @ApiResponse({ status: 400, description: 'User is not blocked' })
  @ApiResponse({ status: 404, description: 'User not found' })
  unblockUser(@Request() req, @Param('userId') userId: string) {
    return this.adminUsersService.unblockUser(req.user.sub, userId);
  }

  // ─────────────────────────────────────────────────────────────
  // BLOCK / UNBLOCK — Provider
  // ─────────────────────────────────────────────────────────────

  @Patch('providers/:providerId/block')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BLOCK, entity: 'ServiceProvider', entityIdKey: 'providerId' })
  @ApiOperation({ summary: 'Block a service provider account' })
  @ApiResponse({ status: 200, description: 'Provider blocked successfully' })
  @ApiResponse({ status: 400, description: 'Provider already blocked or has an active engagement' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  blockProvider(
    @Request() req,
    @Param('providerId') providerId: string,
    @Body() dto: BlockAccountDto,
  ) {
    return this.adminUsersService.blockProvider(req.user.sub, providerId, dto.reason);
  }

  @Patch('providers/:providerId/unblock')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UNBLOCK, entity: 'ServiceProvider', entityIdKey: 'providerId' })
  @ApiOperation({ summary: 'Unblock a service provider account' })
  @ApiResponse({ status: 200, description: 'Provider unblocked successfully' })
  @ApiResponse({ status: 400, description: 'Provider is not blocked' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  unblockProvider(@Request() req, @Param('providerId') providerId: string) {
    return this.adminUsersService.unblockProvider(req.user.sub, providerId);
  }
}