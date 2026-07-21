import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

/**
 * ReviewsService (docs/reviews-implementation-plan.md)
 *
 * Every review targets a single service's booking — package-sourced or not,
 * there is no package-level review (§1/§9 of the doc).
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  async createReview(userId: string, bookingId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== userId) throw new ForbiddenException('Access denied');
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException(`Booking must be COMPLETED before it can be reviewed (current status: ${booking.status})`);
    }

    const existing = await this.prisma.review.findUnique({ where: { bookingId } });
    if (existing) throw new BadRequestException('This booking has already been reviewed');

    // Recompute the aggregate synchronously in the same transaction as the
    // insert (docs §2) — read-after-write consistency matters here, and the
    // write volume never justifies async aggregation.
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          bookingId,
          customerId: userId,
          serviceId: booking.serviceId,
          rating: dto.rating,
          comment: dto.comment,
        },
      });

      const agg = await tx.review.aggregate({
        where: { serviceId: booking.serviceId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.service.update({
        where: { id: booking.serviceId },
        data: { rating: agg._avg.rating ?? 0, totalReviews: agg._count },
      });

      return created;
    });

    return { message: 'Review submitted successfully', data: review };
  }

  async getMyReview(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== userId) throw new ForbiddenException('Access denied');

    const review = await this.prisma.review.findUnique({ where: { bookingId } });
    if (!review) throw new NotFoundException('No review for this booking yet');

    return { message: 'Review retrieved successfully', data: review };
  }

  async getServiceReviews(serviceId: string, query: PaginationDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { serviceId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { fullName: true, profileImage: true } } },
      }),
      this.prisma.review.count({ where: { serviceId } }),
    ]);

    return {
      message: 'Reviews retrieved successfully',
      data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    };
  }

  async replyToReview(userId: string, reviewId: string, dto: ReplyReviewDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { provider: true } });
    if (!user || !user.provider) throw new NotFoundException('Provider not found');

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { service: true, customer: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.service.providerId !== user.provider.id) throw new ForbiddenException('Access denied');
    if (review.providerReply) throw new BadRequestException('This review already has a reply');

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { providerReply: dto.providerReply },
    });

    this.domainEventBus.reviewReplied({
      actorId: userId,
      targetUserId: review.customerId,
      entityId: review.id,
      reviewId: review.id,
      serviceId: review.serviceId,
    });

    return { message: 'Reply posted successfully', data: updated };
  }
}
