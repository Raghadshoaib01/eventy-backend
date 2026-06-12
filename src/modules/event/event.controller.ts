import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventService } from './event.service';

@ApiTags('Events')
@Controller('event')
export class EventController {
 constructor(
    private readonly eventService: EventService,
  ) {}
  // ========================
  //  Create new event
  // ========================
  @Post()
  @ApiOperation({
    summary: 'Create new event',
  })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully',
  })
  createEvent(
    @Body() body: any,
  ) {
    return this.eventService.createEvent(body);
  }

  // ========================
  //  Get event bookings
  // ========================
  @Get(':eventId/bookings')
  @ApiOperation({
    summary: 'Get event bookings',
  })
  @ApiResponse({
    status: 200,
    description: 'Event bookings retrieved successfully',
  })
  getEventBookings(
    @Param('eventId') eventId: string,
  ) {
    return this.eventService.getEventBookings(
      eventId,
    );
  }


}
