import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { DeliveryService } from '../delivery.service';

/**
 * Customer-facing Delivery API (docs/delivery-implementation-plan.md §4.2).
 */
@ApiTags('Deliveries')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingDeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get(':bookingId/delivery')
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiOperation({ summary: 'View delivery status for one of my own bookings' })
  findForBooking(@Request() req, @Param('bookingId') bookingId: string) {
    return this.deliveryService.getForBooking(req.user.sub, bookingId);
  }
}
