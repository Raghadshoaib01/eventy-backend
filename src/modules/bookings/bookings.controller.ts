// src/modules/bookings/bookings.controller.ts
import {
  Body,
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
import { QuoteDecisionDto } from './dto/quote-decision.dto';

@ApiTags('Bookings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ────────────────────────────────────────────
  // PATCH /bookings/:bookingId/quote-decision
  // ────────────────────────────────────────────
  @Patch(':bookingId/quote-decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Customer accepts or rejects a provider quote',
    description:
      'Single entry point for quote decisions. ' +
      'accept=true routes to the confirm-quote flow, accept=false routes to the reject-quote flow.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Quote decision processed successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found or not in QUOTE_SENT status' })
  quoteDecision(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Body() { accept }: QuoteDecisionDto,
  ) {
    return accept
      ? this.bookingsService.confirmQuote(req.user.sub, bookingId)
      : this.bookingsService.rejectQuote(req.user.sub, bookingId);
  }
}