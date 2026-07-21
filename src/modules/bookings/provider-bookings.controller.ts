// src/modules/bookings/provider-bookings.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { ProviderBookingsService } from './provider-bookings.service';
import { SendQuoteDto } from './dto/send-quote.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { Audit } from 'src/common/decorators/audit.decorator';
import { AuditAction } from '@prisma/client';
import { RejectBookingDto } from './dto/reject-booking.dto';

@ApiTags('Provider Bookings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('provider-bookings')
export class ProviderBookingsController {
  constructor(
    private readonly providerBookingsService: ProviderBookingsService,
  ) {}

  // ────────────────────────────────────────────
  // GET /provider-bookings
  // ────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'Get all provider bookings with pagination— use limit=10 for dashboard',
  })
  @ApiResponse({ status: 200, description: 'Provider bookings retrieved successfully' })
  getProviderBookings(@Request() req, @Query() pagination: PaginationDto) {
    return this.providerBookingsService.getProviderBookings(
      req.user.sub,
      pagination,
    );
  }

  // ────────────────────────────────────────────
  // GET /provider-bookings/:bookingId
  // ────────────────────────────────────────────
  @Get(':bookingId')
  @ApiOperation({ summary: 'Get full booking details' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Booking details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  getBookingDetails(@Request() req, @Param('bookingId') bookingId: string) {
    return this.providerBookingsService.getBookingDetails(
      req.user.sub,
      bookingId,
    );
  }

  // ────────────────────────────────────────────
  // PATCH /provider-bookings/:bookingId/quote
  // ────────────────────────────────────────────
  @Patch(':bookingId/quote')
  @Audit({ action: AuditAction.BOOKING_QUOTE, entity: 'Booking', entityIdKey: 'bookingId' })
  @ApiOperation({
    summary: 'Send price quote to customer',
    description:
      'For services WITH sub-services: provide items[]. ' +
      'For HALL/SOUND without sub-services: provide finalAmount only.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Quote sent to customer successfully' })
  @ApiResponse({ status: 400, description: 'Booking is not PENDING or invalid payload' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  sendQuote(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Body() dto: SendQuoteDto,
  ) {
    return this.providerBookingsService.sendQuote(req.user.sub, bookingId, dto);
  }

  // ────────────────────────────────────────────
  // PATCH /provider-bookings/:bookingId/complete
  // ────────────────────────────────────────────
  @Patch(':bookingId/complete')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BOOKING_COMPLETE, entity: 'Booking', entityIdKey: 'bookingId' })
  @ApiOperation({ summary: 'Mark an IN_PROGRESS booking as completed' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Booking marked as completed' })
  @ApiResponse({ status: 400, description: 'Booking is not IN_PROGRESS' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  completeBooking(@Request() req, @Param('bookingId') bookingId: string) {
    return this.providerBookingsService.completeBooking(req.user.sub, bookingId);
  }

  // ────────────────────────────────────────────
  // PATCH /provider-bookings/:bookingId/reject
  // ────────────────────────────────────────────
  @Patch(':bookingId/reject')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BOOKING_REJECT, entity: 'Booking', entityIdKey: 'bookingId' })
@ApiOperation({ summary: 'Reject a pending booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Booking marked as rejected' })
  @ApiResponse({ status: 400, description: 'Booking is not PENDING' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  rejectBooking(@Request() req, @Param('bookingId') bookingId: string, @Body() dto: RejectBookingDto,) {
    return this.providerBookingsService.rejectBooking(req.user.sub, bookingId,dto);
  }
}