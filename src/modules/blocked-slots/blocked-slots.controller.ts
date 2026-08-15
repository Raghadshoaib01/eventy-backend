// src/modules/blocked-slots/blocked-slots.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { BlockedSlotsService } from './blocked-slots.service';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';
import { BlockedSlotsCalendarQueryDto } from './dto/blocked-slots-query.dto';

@ApiTags('Provider Blocked Slots')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROVIDER)
@Controller('provider/blocked-slots')
export class BlockedSlotsController {
  constructor(private readonly blockedSlotsService: BlockedSlotsService) {}

  @Post()
  @ApiOperation({
    summary: 'Block a service (or all services) for a date or date range',
    description: 'Omit serviceId to block the provider entirely (e.g. vacation). Omit toDate for a single day.',
  })
  @ApiResponse({ status: 201, description: 'Blocked slot(s) created successfully' })
  create(@Request() req, @Body() dto: CreateBlockedSlotDto) {
    return this.blockedSlotsService.create(req.user.sub, dto);
  }

  // يجب أن تسبق ':id' كي لا يبتلعها الراوت الديناميكي
  @Get('calendar')
  @ApiOperation({ summary: 'Get calendar view: blocked slots and active bookings within a date range' })
  @ApiQuery({ name: 'fromDate', example: '2026-09-01' })
  @ApiQuery({ name: 'toDate', example: '2026-09-07' })
  @ApiResponse({ status: 200, description: 'Calendar retrieved successfully' })
  getCalendar(@Request() req, @Query() query: BlockedSlotsCalendarQueryDto) {
    return this.blockedSlotsService.getCalendar(req.user.sub, query.fromDate, query.toDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single blocked slot' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Blocked slot retrieved successfully' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.blockedSlotsService.findOne(req.user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a blocked slot',
    description: 'Pass ?wholeGroup=true to delete the entire multi-day range this slot belongs to.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'wholeGroup', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Blocked slot deleted successfully' })
  remove(@Request() req, @Param('id') id: string, @Query('wholeGroup') wholeGroup?: string) {
    return this.blockedSlotsService.remove(req.user.sub, id, wholeGroup === 'true');
  }
}