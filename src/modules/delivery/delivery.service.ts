import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { FulfillmentStatus } from '@prisma/client';

const VALID_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  SCHEDULED: [FulfillmentStatus.OUT_FOR_DELIVERY, FulfillmentStatus.FAILED],
  OUT_FOR_DELIVERY: [FulfillmentStatus.DELIVERED, FulfillmentStatus.FAILED],
  DELIVERED: [],
  FAILED: [],
};

/**
 * DeliveryService (docs/delivery-implementation-plan.md)
 *
 * Status tracking only — not a logistics/routing system. Delivery
 * requirement is fixed per ServiceType, never provider-configurable per
 * service (§1/§2).
 */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  /**
   * Called once a Booking reaches CONFIRMED (docs §3, mirrors when Payment
   * is created for the same booking). No-op if the service's type doesn't
   * require delivery — most bookings never get a Delivery row at all.
   */
  async createIfRequired(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: { include: { serviceType: true } }, event: true },
    });
    if (!booking || !booking.service.serviceType.requiresDeliveryByDefault) return;

    const existing = await this.prisma.delivery.findUnique({ where: { bookingId } });
    if (existing) return;

    await this.prisma.delivery.create({
      data: {
        bookingId,
        status: FulfillmentStatus.SCHEDULED,
        address: booking.event?.eventLocation ?? '',
        scheduledAt: booking.event?.eventDate,
      },
    });
  }

  async listForProvider(userId: string, query: PaginationDto & { status?: FulfillmentStatus }) {
    const provider = await this.prisma.serviceProvider.findFirst({ where: { userId } });
    if (!provider) throw new NotFoundException('Provider not found');

    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;
    const where = { booking: { providerId: provider.id }, ...(status && { status }) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { booking: { include: { service: { include: { serviceType: true } }, customer: { select: { fullName: true } } } } },
      }),
      this.prisma.delivery.count({ where }),
    ]);

    return {
      message: 'Deliveries retrieved successfully',
      data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    };
  }

  async updateStatus(userId: string, deliveryId: string, dto: UpdateDeliveryStatusDto) {
    const provider = await this.prisma.serviceProvider.findFirst({ where: { userId } });
    if (!provider) throw new NotFoundException('Provider not found');

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { booking: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.booking.providerId !== provider.id) throw new ForbiddenException('Access denied');

    const allowed = VALID_TRANSITIONS[delivery.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Cannot move a delivery from ${delivery.status} to ${dto.status}`);
    }

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: dto.status,
        notes: dto.notes,
        deliveredAt: dto.status === FulfillmentStatus.DELIVERED ? new Date() : undefined,
      },
    });

    const payload = {
      actorId: userId,
      targetUserId: delivery.booking.customerId,
      entityId: delivery.id,
      deliveryId: delivery.id,
      bookingId: delivery.bookingId,
    };

    if (dto.status === FulfillmentStatus.OUT_FOR_DELIVERY) this.domainEventBus.deliveryOutForDelivery(payload);
    if (dto.status === FulfillmentStatus.DELIVERED) this.domainEventBus.deliveryCompleted(payload);
    if (dto.status === FulfillmentStatus.FAILED) this.domainEventBus.deliveryFailed(payload);

    return { message: 'Delivery status updated', data: updated };
  }

  async getForBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== userId) throw new ForbiddenException('Access denied');

    const delivery = await this.prisma.delivery.findUnique({ where: { bookingId } });
    if (!delivery) throw new NotFoundException('This service does not require delivery');

    return { message: 'Delivery retrieved successfully', data: delivery };
  }
}
