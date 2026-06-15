// src/modules/bookings/provider-bookings.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { SendQuoteDto } from './dto/send-quote.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@Injectable()
export class ProviderBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // GET /provider-bookings  (full list with pagination)
  // ─────────────────────────────────────────────────────────────
  async getProviderBookings(userId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 10, order = 'desc' } = paginationDto;
    const skip = (page - 1) * limit;

    const provider = await this.prisma.serviceProvider.findFirst({
      where: { userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const [bookings, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where: { providerId: provider.id },
        skip,
        take: limit,
        orderBy: { createdAt: order },
        include: {
          event: {
            select: { name: true, eventDate: true, eventType: true },
          },
          service: {
            include: { serviceType: { select: { name: true } } },
          },
          customer: {
            select: { fullName: true, phoneNumber: true, profileImage: true },
          },
        },
      }),
      this.prisma.booking.count({ where: { providerId: provider.id } }),
    ]);

    return {
      message: 'Provider bookings retrieved successfully',
      data: {
        items: bookings,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GET /provider-bookings/:bookingId
  // ─────────────────────────────────────────────────────────────
  async getBookingDetails(userId: string, bookingId: string) {
    const provider = await this.prisma.serviceProvider.findFirst({
      where: { userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, providerId: provider.id },
      include: {
        event: true,
        service: {
          include: {
            serviceType: true,
            files: true,
          },
        },
        customer: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
            profileImage: true,
            locationName: true,
          },
        },
        timeSlot: true,
        items: {
          include: {
            subService: {
              include: { media: { take: 2 } },
            },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    return {
      message: 'Booking details retrieved successfully',
      data: booking,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PATCH /provider-bookings/:bookingId/quote
  // ─────────────────────────────────────────────────────────────
  async sendQuote(userId: string, bookingId: string, dto: SendQuoteDto) {
    const provider = await this.prisma.serviceProvider.findFirst({
      where: { userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, providerId: provider.id },
      include: {
        items: true,
        event: { select: { eventDate: true } },
        service: { include: { serviceType: { select: { name: true } } } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot send quote — booking is already ${booking.status}`,
      );
    }

    const hasSubServices = booking.items.length > 0;

    // Validate input matches service type
    if (hasSubServices) {
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException(
          'Quote items are required for this service type',
        );
      }
      const bookingItemIds = new Set(booking.items.map((i) => i.id));
      for (const qi of dto.items) {
        if (!bookingItemIds.has(qi.bookingItemId)) {
          throw new BadRequestException(
            `BookingItem "${qi.bookingItemId}" does not belong to this booking`,
          );
        }
      }
    } else {
      if (dto.finalAmount === undefined || dto.finalAmount === null) {
        throw new BadRequestException(
          'finalAmount is required for services without sub-services (HALL, SOUND)',
        );
      }
    }

    // Update prices inside a transaction
    await this.prisma.$transaction(async (tx) => {
      let finalAmount = 0;

      if (hasSubServices && dto.items) {
        for (const qi of dto.items) {
          const item = booking.items.find((i) => i.id === qi.bookingItemId)!;
          const finalTotalPrice = qi.finalUnitPrice * item.quantity;
          finalAmount += finalTotalPrice;

          await tx.bookingItem.update({
            where: { id: qi.bookingItemId },
            data: {
              finalUnitPrice: qi.finalUnitPrice,
              finalTotalPrice,
            },
          });
        }
      } else {
        finalAmount = dto.finalAmount!;
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          finalAmount,
          providerNotes: dto.providerNotes,
          status: 'QUOTE_SENT',
        },
      });
    });

    // Notify customer
    this.domainEventBus.bookingQuoteSent({
      actorId: userId,
      targetUserId: booking.customerId,
      entityId: bookingId,
      bookingId,
      serviceName: booking.service.serviceType.name,
      eventDate: booking.event!.eventDate,
    });

    const updated = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: true },
    });

    return {
      message: 'Quote sent to customer successfully',
      data: updated,
    };
  }
}