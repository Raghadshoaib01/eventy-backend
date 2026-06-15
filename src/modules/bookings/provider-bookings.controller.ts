// src/modules/bookings/provider-bookings.controller.ts
import {
  Body,
  Controller,
  Get,
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
}