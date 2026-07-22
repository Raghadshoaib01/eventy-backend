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
import { BookingStatus, Prisma, UserRole } from '@prisma/client';
import { JwtPayload } from 'src/common/helpers/token.helper';
import { GetEventsDto } from './dto/get-events.dto';
import { isRangeWithinWindow, rangesOverlap } from 'src/common/helpers/time.helper';


const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'PENDING',
  'QUOTE_SENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
];
@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // POST /events
  // ─────────────────────────────────────────────────────────────
  /*
  async createEvent0(customerId: string, dto: CreateEventDto) {
    // 1. Verify customer record exists
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
    });
    if (!customer) throw new NotFoundException('Customer account not found');

    // 2. Load all requested services in one query
    const serviceIds = [...new Set(dto.services.map((s) => s.serviceId))];

    const services = await this.prisma.service.findMany({
      // package-exclusive services can never be booked standalone
      // (docs/packages-implementation-plan.md §6) — excluding them here means a
      // customer trying to book one gets the same "not found" treatment as any
      // other unavailable service, and it happens at the one place all
      // standalone bookings are created.
      where: { id: { in: serviceIds }, approvalStatus: 'ACTIVE', isCompleted: true, isPackaged: false },
      include: {
        serviceType: true,
        provider: { include: { user: { select: { id: true } } } },
        subServices: { where: { isAvailable: true, approvalStatus: 'ACTIVE' } },
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

        for (const item of svcInput.items?? []) {
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
  */

  // ─────────────────────────────────────────────────────────────
  // POST /events
  // ─────────────────────────────────────────────────────────────
  async createEvent(customerId: string, dto: CreateEventDto) {
    // 1. Verify customer record exists
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
    });
    if (!customer) throw new NotFoundException('Customer account not found');

    if (dto.eventStartTime === dto.eventEndTime) {
      throw new BadRequestException(
        'eventEndTime must be different from eventStartTime',
      );
    }

    // 2. Load all requested services in one query
    const serviceIds = [...new Set(dto.services.map((s) => s.serviceId))];

    const services = await this.prisma.service.findMany({
      // package-exclusive services can never be booked standalone
      where: {
        id: { in: serviceIds },
        approvalStatus: 'ACTIVE',
        isCompleted: true,
        isPackaged: false,
      },
      include: {
        serviceType: true,
        provider: { include: { user: { select: { id: true } } } },
        subServices: {
          where: { isAvailable: true, approvalStatus: 'ACTIVE' },
        },
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

    // 4. Per-service structural validations (day / working-hours / slot bounds).
    //    Safe to run before the transaction — they depend only on the
    //    service's static definition, not on concurrently-changing bookings.
    const matchedByService = new Map<string, { availability: any; slot?: any }>();

    for (const svcInput of dto.services) {
      const svc = services.find((s) => s.id === svcInput.serviceId)!;

      // 4a. Availability block(s) that work on the requested day
      const dayAvailabilities = svc.availability.filter((a) =>
        a.workingDays.some((d) => d.dayOfWeek === dayOfWeek),
      );
      if (dayAvailabilities.length === 0) {
        throw new BadRequestException(
          `Service "${svc.serviceType.name}" does not work on ${dayOfWeek}`,
        );
      }

      // 4b. Resolve which availability/slot applies and validate containment
      let matched: (typeof dayAvailabilities)[number] | undefined;
      let matchedSlot: any;

      if (svcInput.timeSlotId) {
        matched = dayAvailabilities.find(
          (a) =>
            a.hasSlots && a.timeSlots.some((t) => t.id === svcInput.timeSlotId),
        );
        if (!matched) {
          throw new BadRequestException(
            `Selected time slot does not belong to service "${svc.serviceType.name}" on ${dayOfWeek}`,
          );
        }
        matchedSlot = matched.timeSlots.find(
          (t) => t.id === svcInput.timeSlotId,
        )!;

        if (
          !isRangeWithinWindow(
            dto.eventStartTime,
            dto.eventEndTime,
            matchedSlot.fromTime,
            matchedSlot.toTime,
          )
        ) {
          throw new BadRequestException(
            `Event time must be fully within the selected slot (${matchedSlot.fromTime}-${matchedSlot.toTime}) for "${svc.serviceType.name}"`,
          );
        }
      } else {
        matched = dayAvailabilities.find((a) => !a.hasSlots);
        if (!matched) {
          throw new BadRequestException(
            `Service "${svc.serviceType.name}" requires selecting a timeSlotId on ${dayOfWeek}`,
          );
        }

        if (
          !isRangeWithinWindow(
            dto.eventStartTime,
            dto.eventEndTime,
            matched.workFromTime,
            matched.workToTime,
          )
        ) {
          throw new BadRequestException(
            `Event time (${dto.eventStartTime}-${dto.eventEndTime}) is outside working hours (${matched.workFromTime}-${matched.workToTime}) for "${svc.serviceType.name}"`,
          );
        }
      }

      matchedByService.set(svcInput.serviceId, {
        availability: matched,
        slot: matchedSlot,
      });

      // 4c. Guest capacity check
      if (
        dto.numberOfGuests &&
        svc.maxCapacity &&
        dto.numberOfGuests > svc.maxCapacity
      ) {
        throw new BadRequestException(
          `Service "${svc.serviceType.name}" cannot accommodate ${dto.numberOfGuests} guests (max: ${svc.maxCapacity})`,
        );
      }

      // 4d. Sub-service items required depending on service type
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

      // 4e. Every sub-service must belong to this service
      for (const item of svcInput.items ?? []) {
        const sub = svc.subServices.find((ss) => ss.id === item.subServiceId);
        if (!sub) {
          throw new BadRequestException(
            `SubService "${item.subServiceId}" not found or not available in service "${svc.serviceType.name}"`,
          );
        }
      }
    }

    // 5. Create Event + all Bookings + all BookingItems in one transaction.
    //    Duplicate check, blocked-slot check, and all three capacity layers
    //    (ServiceAvailability.capacity, TimeSlot.capacity, SubService.dailyCapacity)
    //    run INSIDE the transaction so the whole event is rejected atomically
    //    if any condition fails, on a consistent snapshot.
    const result = await this.prisma.$transaction(
      async (tx) => {
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
          const { availability: matchedAvailability, slot: matchedSlot } =
            matchedByService.get(svcInput.serviceId)!;

          // 5a. Idempotency — no active booking for same service on same date
          const duplicate = await tx.booking.findFirst({
            where: {
              customerId,
              serviceId: svcInput.serviceId,
              status: { in: ACTIVE_BOOKING_STATUSES },
              event: { eventDate: { gte: startOfDay, lte: endOfDay } },
            },
          });
          if (duplicate) {
            throw new ConflictException(
              `You already have an active booking for "${svc.serviceType.name}" on this date`,
            );
          }

          // 5b. Blocked slot check
          const blockedSlots = await tx.blockedSlot.findMany({
            where: {
              serviceId: svc.id,
              date: { gte: startOfDay, lte: endOfDay },
            },
          });
          const isBlocked = blockedSlots.some((b) => {
            if (!b.fromTime || !b.toTime) return true; // whole day blocked
            return rangesOverlap(
              dto.eventStartTime,
              dto.eventEndTime,
              b.fromTime,
              b.toTime,
            );
          });
          if (isBlocked) {
            throw new ConflictException(
              `Service "${svc.serviceType.name}" is unavailable at the requested time on this date`,
            );
          }

          // 5c. ServiceAvailability-level daily capacity
          const availabilityBookingCount = await tx.booking.count({
            where: {
              serviceId: svc.id,
              status: { in: ACTIVE_BOOKING_STATUSES },
              event: { eventDate: { gte: startOfDay, lte: endOfDay } },
              ...(matchedAvailability.hasSlots
                ? { timeSlot: { availabilityId: matchedAvailability.id } }
                : { timeSlotId: null }),
            },
          });
          if (availabilityBookingCount >= matchedAvailability.capacity) {
            throw new ConflictException(
              `Service "${svc.serviceType.name}" has reached its daily capacity for the requested time window`,
            );
          }

          // 5d. TimeSlot-level capacity (only when a slot was selected)
          if (matchedSlot) {
            const slotBookingCount = await tx.booking.count({
              where: {
                timeSlotId: matchedSlot.id,
                status: { in: ACTIVE_BOOKING_STATUSES },
                event: { eventDate: { gte: startOfDay, lte: endOfDay } },
              },
            });
            if (slotBookingCount >= matchedSlot.capacity) {
              throw new ConflictException(
                `Selected time slot for "${svc.serviceType.name}" is fully booked`,
              );
            }
          }

          // Build booking items and calculate totalAmount
          let totalAmount = 0;
          const itemsData: Array<{
            subServiceId: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
          }> = [];

          for (const item of svcInput.items ?? []) {
            const sub = svc.subServices.find(
              (ss) => ss.id === item.subServiceId,
            )!;

            // 5e. SubService daily capacity
            const existingQtyAgg = await tx.bookingItem.aggregate({
              _sum: { quantity: true },
              where: {
                subServiceId: item.subServiceId,
                booking: {
                  status: { in: ACTIVE_BOOKING_STATUSES },
                  event: { eventDate: { gte: startOfDay, lte: endOfDay } },
                },
              },
            });
            const existingQty = existingQtyAgg._sum.quantity ?? 0;
            if (existingQty + item.quantity > sub.dailyCapacity) {
              throw new ConflictException(
                `SubService "${sub.name}" exceeds its daily capacity (${sub.dailyCapacity}) for this date`,
              );
            }

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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
  // GET /events/:eventId/bookings — unchanged, keep as-is
  // GET /events — unchanged, keep as-is
  // ─────────────────────────────────────────────────────────────


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
    fromDate,
    toDate,
    archived,
  } = dto;

  const skip = (page - 1) * limit;

  const where: any = { archivedAt: archived ? { not: null } : null };

  // فلتر الحالة إذا تم تمريرها
  if (status) {
    where.status = status;
  }

  // فلتر المدى الزمني (يُستخدم من قِبل التقويم)
  if (fromDate || toDate) {
    where.eventDate = {
      ...(fromDate && { gte: new Date(fromDate) }),
      ...(toDate && { lte: new Date(toDate) }),
    };
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
    message: 'Events retrieved successfully',
    data: {
      items: events,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
}

  // ─────────────────────────────────────────────────────────────
  // PATCH /events/:eventId/archive
  // PATCH /events/:eventId/unarchive
  // ─────────────────────────────────────────────────────────────
  private async setArchived(user: JwtPayload, eventId: string, archived: boolean) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    if (user.role !== UserRole.ADMIN && event.customerId !== user.sub) {
      throw new ForbiddenException('Access denied — not your event');
    }

    if (!['COMPLETED', 'CANCELLED'].includes(event.status)) {
      throw new BadRequestException(
        'Only COMPLETED or CANCELLED events can be archived/unarchived',
      );
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { archivedAt: archived ? new Date() : null },
    });

    return {
      message: archived ? 'Event archived successfully' : 'Event unarchived successfully',
      data: { eventId: updated.id, archivedAt: updated.archivedAt },
    };
  }

  archiveEvent(user: JwtPayload, eventId: string) {
    return this.setArchived(user, eventId, true);
  }

  unarchiveEvent(user: JwtPayload, eventId: string) {
    return this.setArchived(user, eventId, false);
  }

}