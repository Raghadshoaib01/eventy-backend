// src/modules/event/event.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { CreateEventDto } from './dto/create-event.dto';
import { Prisma, UserRole } from '@prisma/client';
import { JwtPayload } from 'src/common/helpers/token.helper';
import { GetEventsDto } from './dto/get-events.dto';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // POST /events
  // ─────────────────────────────────────────────────────────────
  async createEvent(customerId: string, dto: CreateEventDto) {
    // 1. Verify customer record exists
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
    });
    if (!customer) throw new NotFoundException('Customer account not found');

    // 2. Load all requested services in one query
    const serviceIds = [...new Set(dto.services.map((s) => s.serviceId))];

    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, approvalStatus: 'ACTIVE', isCompleted: true },
      include: {
        serviceType: true,
        provider: { include: { user: { select: { id: true } } } },
        subServices: { where: { isAvailable: true } },
        availability: { include: { workingDays: true, timeSlots: true } },
      },
    });

    if (services.length !== serviceIds.length) {
      const found = new Set(services.map((s) => s.id));
      const missing = serviceIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Services not active or not found: ${missing.join(', ')}`,
      );
    }

    // 3. Shared date helpers
    const eventDate = new Date(dto.eventDate);
    const DAY_NAMES = [
      'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
      'THURSDAY', 'FRIDAY', 'SATURDAY',
    ];
    const dayOfWeek = DAY_NAMES[eventDate.getDay()];

    const startOfDay = new Date(eventDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(eventDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 4. Per-service validations (before opening transaction)
    for (const svcInput of dto.services) {
      const svc = services.find((s) => s.id === svcInput.serviceId)!;

      // 4a. Service must work on the requested day
      const worksOnDay = svc.availability.some((a) =>
        a.workingDays.some((d) => d.dayOfWeek === dayOfWeek),
      );
      if (!worksOnDay) {
        throw new BadRequestException(
          `Service "${svc.serviceType.name}" does not work on ${dayOfWeek}`,
        );
      }

      // 4b. Guest capacity check
      if (
        dto.numberOfGuests &&
        svc.maxCapacity &&
        dto.numberOfGuests > svc.maxCapacity
      ) {
        throw new BadRequestException(
          `Service "${svc.serviceType.name}" cannot accommodate ${dto.numberOfGuests} guests (max: ${svc.maxCapacity})`,
        );
      }
        // ✅ فحص الخدمات الفرعية حسب نوع الخدمة
      const HALL_SOUND = ['HALL', 'SOUND'];
      const requiresItems = !HALL_SOUND.includes(svc.serviceType.name);

      if (requiresItems && (!svcInput.items || svcInput.items.length === 0)) {
        throw new BadRequestException(
          `Service "${svc.serviceType.name}" requires at least one sub-service item`,
        );
      }

      if (!requiresItems && svcInput.items && svcInput.items.length > 0) {
        throw new BadRequestException(
          `Service "${svc.serviceType.name}" does not accept sub-service items — remove the items array`,
        );
      }
      // 4c. Idempotency: no active booking for same service on same date
      const duplicate = await this.prisma.booking.findFirst({
        where: {
          customerId,
          serviceId: svcInput.serviceId,
          status: {
            in: ['PENDING', 'QUOTE_SENT', 'CONFIRMED', 'IN_PROGRESS'],
          },
          event: { eventDate: { gte: startOfDay, lte: endOfDay } },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `You already have an active booking for "${svc.serviceType.name}" on this date`,
        );
      }

      // 4d. Validate every sub-service belongs to this service
      for (const item of svcInput.items?? []) {
        const sub = svc.subServices.find((ss) => ss.id === item.subServiceId);
        if (!sub) {
          throw new BadRequestException(
            `SubService "${item.subServiceId}" not found or not available in service "${svc.serviceType.name}"`,
          );
        }
      }
    }

    // 5. Create Event + all Bookings + all BookingItems in one transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          customerId,
          name: dto.name,
          eventType: dto.eventType,
          eventDate,
          eventStartTime: dto.eventStartTime,
          eventEndTime: dto.eventEndTime,
          eventLocation: dto.eventLocation,
          numberOfGuests: dto.numberOfGuests,
          customerNotes: dto.customerNotes,
          status: 'ACTIVE',
        },
      });

      const createdBookings: Array<{
        booking: any;
        providerUserId: string;
        serviceName: string;
      }> = [];

      for (const svcInput of dto.services) {
        const svc = services.find((s) => s.id === svcInput.serviceId)!;

        // Build booking items and calculate totalAmount
        let totalAmount = 0;
        const itemsData: Array<{
          subServiceId: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
        }> = [];

        for (const item of svcInput.items) {
          const sub = svc.subServices.find((ss) => ss.id === item.subServiceId)!;
          const totalPrice = sub.pricePerUnit * item.quantity;
          totalAmount += totalPrice;
          itemsData.push({
            subServiceId: item.subServiceId,
            quantity: item.quantity,
            unitPrice: sub.pricePerUnit,
            totalPrice,
          });
        }

        // Hall / Sound — no sub-services, use service.price as initial amount
        if (itemsData.length === 0 && svc.price) {
          totalAmount = svc.price;
        }

      const bookingData: Prisma.BookingUncheckedCreateInput = {
        eventId: event.id,
        customerId,
        providerId: svc.providerId,
        serviceId: svcInput.serviceId,
        timeSlotId: svcInput.timeSlotId ?? null,
        totalAmount,
        status: 'PENDING',
        items: { create: itemsData },
      };
      const booking = await tx.booking.create({
        data: bookingData,
        include: {
          items: true,
          service: { include: { serviceType: { select: { name: true } } } },
        },
      });
        createdBookings.push({
          booking,
          providerUserId: svc.provider.user.id,
          serviceName: svc.serviceType.name,
        });
      }

      return { event, createdBookings };
    });

    // 6. Emit BOOKING_CREATED for every provider (outside transaction — non-blocking)
    for (const { booking, providerUserId, serviceName } of result.createdBookings) {
      this.domainEventBus.bookingCreated({
        actorId: customerId,
        targetUserId: providerUserId,
        entityId: booking.id,
        bookingId: booking.id,
        serviceName,
        eventDate,
      });
    }

    return {
      message: 'Event and bookings created successfully',
      data: {
        event: result.event,
        bookings: result.createdBookings.map((cb) => cb.booking),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GET /events/:eventId/bookings
  // ─────────────────────────────────────────────────────────────
  async getEventBookings( eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        bookings: {
          include: {
            service: {
              include: {
                serviceType: { select: { name: true } },
                files: { take: 1 },
              },
            },
            provider: {
              include: {
                user: { select: { fullName: true, profileImage: true, phoneNumber: true } },
              },
            },
            items: {
              include: {
                subService: {
                  select: { name: true, unitType: true, pricePerUnit: true },
                },
              },
            },
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    // if (event.customerId !== customerId) {
    //   throw new ForbiddenException('Access denied');
    // }

    return {
      message: 'Event bookings retrieved successfully',
      data: event,
    };
    
  }
// ─────────────────────────────────────────────────────────────
  // GET /events
  // ─────────────────────────────────────────────────────────────
  async getEvents(
  user: JwtPayload,
  dto: GetEventsDto,
) {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    order = 'desc',
    status,
  } = dto;

  const skip = (page - 1) * limit;

  const where: any = {};

  // فلتر الحالة إذا تم تمريرها
  if (status) {
    where.status = status;
  }

  // إذا لم يكن أدمن يرجع مناسباته فقط
  if (user.role !== UserRole.ADMIN) {
    where.customerId = user.sub;
  }

  const [events, total] = await this.prisma.$transaction([
    this.prisma.event.findMany({
      where,

      skip,
      take: limit,

      orderBy: {
        [sortBy]: order,
      },

      include: {
        // bookings: {
        //   include: {
        //     service: true,
        //   },
        // },

        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    }),

    this.prisma.event.count({
      where,
    }),
  ]);

  return {
    data: events,

    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

}