import { Controller, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  bookingsService: any;

  // ========================
  //  Confirm booking quote
  // ========================
  @Patch(':bookingId/confirm-quote')
  @ApiOperation({
    summary: 'Confirm booking quote',
  })
  @ApiResponse({
    status: 200,
    description: 'Quote confirmed successfully',
  })
  confirmQuote(
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingsService.confirmQuote(
      bookingId,
    );
  }

  // ========================
  //  Reject booking quote
  // ========================
  @Patch(':bookingId/reject-quote')
  @ApiOperation({
    summary: 'Reject booking quote',
  })
  @ApiResponse({
    status: 200,
    description: 'Quote rejected successfully',
  })
  rejectQuote(
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingsService.rejectQuote(
      bookingId,
    );
  }
  
}
