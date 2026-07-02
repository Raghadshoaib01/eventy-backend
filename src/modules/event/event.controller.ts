// src/modules/event/event.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
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
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtPayload } from 'src/common/helpers/token.helper';
import { GetEventsDto } from './dto/get-events.dto';
import { Audit } from 'src/common/decorators/audit.decorator';
import { AuditAction } from '@prisma/client';

@ApiTags('Events')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  // ────────────────────────────────────────────
  // POST /events
  // ────────────────────────────────────────────
  @Post()
  @ApiOperation({
    summary: 'Create new event with one or more service bookings',
    description:
      'Creates an Event record and a PENDING Booking for every selected service. ' +
      'All providers are notified immediately.',
  })
  @ApiResponse({ status: 201, description: 'Event and bookings created successfully' })
  @ApiResponse({ status: 400, description: 'Service not available on requested date / capacity exceeded' })
  @ApiResponse({ status: 404, description: 'Service not found or not active' })
  @ApiResponse({ status: 409, description: 'Duplicate booking for same service on same date' })
  createEvent(@Request() req, @Body() dto: CreateEventDto) {
    return this.eventService.createEvent(req.user.sub, dto);
  }

  // ────────────────────────────────────────────
  // GET /events/:eventId/bookings
  // ────────────────────────────────────────────
  @Get(':eventId/bookings')
  @ApiOperation({
    summary: 'Get all bookings for an event',
    description: 'Returns the full event details with every booking, items, and provider info.',
  })
  @ApiParam({ name: 'eventId', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Event bookings retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied — not your event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  getEventBookings( @Param('eventId') eventId: string) {
    return this.eventService.getEventBookings(eventId);
  }

  @Get()
  @ApiOperation({
    summary: 'List events',
    description:
      'Reused by the admin calendar via fromDate/toDate, and by the archive tab via archived=true. ' +
      'Archived events are hidden from the default list.',
  })
  getEvents(
    @CurrentUser() user: JwtPayload,

    @Query() dto: GetEventsDto,
  ) {
    return this.eventService.getEvents(user, dto);
  }

  // ────────────────────────────────────────────
  // PATCH /events/:eventId/archive
  // ────────────────────────────────────────────
  @Patch(':eventId/archive')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UPDATE, entity: 'Event', entityIdKey: 'eventId' })
  @ApiOperation({
    summary: 'Archive an event',
    description: 'Owner or admin only. Event must be COMPLETED or CANCELLED.',
  })
  @ApiParam({ name: 'eventId', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Event archived successfully' })
  @ApiResponse({ status: 400, description: 'Event is not COMPLETED or CANCELLED' })
  @ApiResponse({ status: 403, description: 'Access denied — not your event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  archiveEvent(@CurrentUser() user: JwtPayload, @Param('eventId') eventId: string) {
    return this.eventService.archiveEvent(user, eventId);
  }

  // ────────────────────────────────────────────
  // PATCH /events/:eventId/unarchive
  // ────────────────────────────────────────────
  @Patch(':eventId/unarchive')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UPDATE, entity: 'Event', entityIdKey: 'eventId' })
  @ApiOperation({
    summary: 'Unarchive an event',
    description: 'Owner or admin only. Event must be COMPLETED or CANCELLED.',
  })
  @ApiParam({ name: 'eventId', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Event unarchived successfully' })
  @ApiResponse({ status: 400, description: 'Event is not COMPLETED or CANCELLED' })
  @ApiResponse({ status: 403, description: 'Access denied — not your event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  unarchiveEvent(@CurrentUser() user: JwtPayload, @Param('eventId') eventId: string) {
    return this.eventService.unarchiveEvent(user, eventId);
  }
}