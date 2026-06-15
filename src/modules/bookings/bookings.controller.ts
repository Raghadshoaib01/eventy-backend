// src/modules/bookings/bookings.controller.ts
import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ────────────────────────────────────────────
  // PATCH /bookings/:bookingId/confirm-quote
  // ────────────────────────────────────────────
  @Patch(':bookingId/confirm-quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Customer confirms provider quote',
    description:
      'Updates booking to AWAITING_CONFIRMATION. ' +
      'If this is the last unconfirmed booking in the event, ' +
      'all bookings and the event move to IN_PROGRESS.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Quote confirmed successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found or not in QUOTE_SENT status' })
  confirmQuote(@Request() req, @Param('bookingId') bookingId: string) {
    return this.bookingsService.confirmQuote(req.user.sub, bookingId);
  }

  // ────────────────────────────────────────────
  // PATCH /bookings/:bookingId/reject-quote
  // ────────────────────────────────────────────
  @Patch(':bookingId/reject-quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Customer rejects provider quote',
    description: 'Cancels the booking. The provider is notified.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Quote rejected — booking cancelled' })
  @ApiResponse({ status: 404, description: 'Booking not found or not in QUOTE_SENT status' })
  rejectQuote(@Request() req, @Param('bookingId') bookingId: string) {
    return this.bookingsService.rejectQuote(req.user.sub, bookingId);
  }
}