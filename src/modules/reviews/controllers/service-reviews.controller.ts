import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { ReviewsService } from '../reviews.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

/**
 * Public Reviews API (docs/reviews-implementation-plan.md §4.3).
 */
@ApiTags('Reviews')
@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServiceReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':id/reviews')
  @Public()
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiOperation({ summary: 'Paginated reviews for a service (public)' })
  findForService(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.reviewsService.getServiceReviews(id, query);
  }
}
