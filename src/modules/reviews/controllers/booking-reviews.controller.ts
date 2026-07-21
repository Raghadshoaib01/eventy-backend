import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ReviewsService } from '../reviews.service';
import { CreateReviewDto } from '../dto/create-review.dto';

/**
 * Customer-facing Reviews API (docs/reviews-implementation-plan.md §4.1).
 */
@ApiTags('Reviews')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':bookingId/review')
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiOperation({ summary: 'Review a completed booking' })
  create(@Request() req, @Param('bookingId') bookingId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.sub, bookingId, dto);
  }

  @Get(':bookingId/review')
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiOperation({ summary: 'Fetch my review for this booking' })
  findMine(@Request() req, @Param('bookingId') bookingId: string) {
    return this.reviewsService.getMyReview(req.user.sub, bookingId);
  }
}
