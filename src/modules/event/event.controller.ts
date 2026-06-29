// src/modules/event/event.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
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
  getEvents(
    @CurrentUser() user: JwtPayload,

    @Query() dto: GetEventsDto,
  ) {
    return this.eventService.getEvents(user, dto);
  }
}