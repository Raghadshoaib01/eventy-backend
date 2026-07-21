import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ReviewsService } from '../reviews.service';
import { ReplyReviewDto } from '../dto/reply-review.dto';

/**
 * Provider-facing Reviews API (docs/reviews-implementation-plan.md §4.2).
 */
@ApiTags('Provider Reviews')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('provider/reviews')
export class ProviderReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Patch(':id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiOperation({ summary: 'Post a reply to a review on my own service' })
  reply(@Request() req, @Param('id') id: string, @Body() dto: ReplyReviewDto) {
    return this.reviewsService.replyToReview(req.user.sub, id, dto);
  }
}
