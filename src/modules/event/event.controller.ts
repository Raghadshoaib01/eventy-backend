// src/modules/event/event.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { EventService } from './event.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtPayload } from 'src/common/helpers/token.helper';
import { GetEventsDto } from './dto/get-events.dto';
import { Audit } from 'src/common/decorators/audit.decorator';
import { AuditAction, UserRole } from '@prisma/client';
import { BulkQuoteDecisionDto } from '../bookings/dto/bulk-quote-decision.dto';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Events')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly bookingsService: BookingsService,
  ) {}

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
  @ApiResponse({ status: 404, description: 'Service not found or not draft' })
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

  // ────────────────────────────────────────────
  // PATCH /events/:eventId/bookings/quote-decisions
  // ────────────────────────────────────────────
  @Patch(':eventId/bookings/quote-decisions')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BOOKING_ACCEPT, entity: 'Event', entityIdKey: 'eventId' })
  @ApiOperation({
    summary: 'Accept and/or reject multiple bookings for an event',
    description:
      'Processes bulk quote decisions in a single transaction. ' +
      'Accepted bookings are confirmed and paid (bank transfer) or marked processing (cash). ' +
      'Rejected bookings are cancelled and providers are notified.',
  })
  @ApiParam({ name: 'eventId', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Quote decisions processed successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or bookings not in QUOTE_SENT status' })
  @ApiResponse({ status: 403, description: 'Access denied — not your event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  bulkQuoteDecision(
    @Request() req,
    @Param('eventId') eventId: string,
    @Body() dto: BulkQuoteDecisionDto,
  ) {
    return this.bookingsService.bulkQuoteDecision(req.user.sub, eventId, dto);
  }


@ApiOperation({
  summary: 'Start an event',
  description:
    'Starts an event manually by the customer. The event can start only when all bookings are finalized, at least one booking is CONFIRMED and PAID, and no booking remains in PENDING, QUOTE_SENT, IN_PROGRESS, or COMPLETED status.',
})
@ApiParam({
  name: 'eventId',
  type: String,
  format: 'uuid',
  description: 'Event ID',
})
@ApiOkResponse({description: 'Event started successfully.' })
@ApiBadRequestResponse({
  description:
    'Event cannot be started because one or more business rules are violated.',
})
@ApiUnauthorizedResponse({
  description: 'User is not authenticated.',
})
@ApiForbiddenResponse({
  description: 'The event does not belong to the current customer.',
})
@ApiNotFoundResponse({
  description: 'Event not found.',
})
  @Patch(':eventId/start')
@Roles(UserRole.CUSTOMER)
startEvent(
  @CurrentUser() user,
  @Param('eventId', ParseUUIDPipe) eventId: string,
) {
  return this.eventService.startEvent(user.id, eventId);
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