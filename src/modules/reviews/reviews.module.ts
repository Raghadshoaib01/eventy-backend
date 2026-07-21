import { Module } from '@nestjs/common';
import { BookingReviewsController } from './controllers/booking-reviews.controller';
import { ServiceReviewsController } from './controllers/service-reviews.controller';
import { ProviderReviewsController } from './controllers/provider-reviews.controller';
import { ReviewsService } from './reviews.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Module({
  controllers: [BookingReviewsController, ServiceReviewsController, ProviderReviewsController],
  providers: [ReviewsService, DomainEventBus],
})
export class ReviewsModule {}
