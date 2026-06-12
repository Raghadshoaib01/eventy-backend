import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProviderBookingsService } from './provider-bookings.service';

@ApiTags('Provider Bookings')
@Controller('provider-bookings')
export class ProviderBookingsController {
     constructor(
    private readonly providerBookingsService: ProviderBookingsService,
  ) {}
  // ========================
  //  Get provider recent bookings
  // ========================
    @Get('recent')
    @ApiOperation({
    summary: 'Get provider recent bookings',
    })
    @ApiResponse({
    status: 200,
    description: 'Recent bookings retrieved successfully',
    })
    getProviderRecentBookings() {
    return this.providerBookingsService.getProviderRecentBookings();
    }
  // ========================
  //  Get booking details
  // ========================
    @Get(':bookingId')
    @ApiOperation({
      summary: 'Get booking details',
    })
    @ApiResponse({
      status: 200,
      description: 'Booking details retrieved successfully',
    })
    getBookingDetails(
      @Param('bookingId') bookingId: string,
    ) {
      return this.providerBookingsService.getBookingDetails(
        bookingId,
      );
    }
  // ========================
  //  Send booking quote
  // ========================
    @Patch(':bookingId/quote')
    @ApiOperation({
      summary: 'Send booking quote',
    })
    @ApiResponse({
      status: 200,
      description: 'Quote sent successfully',
    })
    sendQuote(
      @Param('bookingId') bookingId: string,
    ) {
      return this.providerBookingsService.sendQuote(
        bookingId,
      );
    }

}
