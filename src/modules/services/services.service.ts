import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { AvailableServicesQueryDto } from './dto/available-services-query.dto';
import { ServiceDetailQueryDto } from './dto/service-detail-query.dto';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { EngagementService } from 'src/shared/services/engagement.service';
import { ServiceStatus, FileType, DayOfWeek, Discount } from '@prisma/client';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

import { DiscountsService } from '../discounts/discounts.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService,
        private readonly cloudinaryService: CloudinaryService,
        private readonly engagementService: EngagementService,
        private readonly domainEventBus: DomainEventBus,
        private readonly discountsService: DiscountsService,
  ) {}

// ========================
// ➕ Create Service
// ========================
async createService(
  userId: string,
  dto: CreateServiceDto,
  serviceLogo?: Express.Multer.File,
  businessFile?: Express.Multer.File,
  subServiceMedia?: Express.Multer.File[],
  // Set by PackagesService when this service is created as package-exclusive
  // (docs/packages-implementation-plan.md §5.3) — never provided by the public
  // POST /services endpoint's own DTO.
  packageId?: string,
) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { provider: true },
  });

  if (!user || !user.provider) {
    throw new NotFoundException('Provider not found');
  }

  // ✅ نجلب نوع الخدمة لتحديد HALL/SOUND vs بقية الأنواع
  const serviceType = await this.prisma.serviceType.findUnique({
    where: { id: dto.serviceTypeId },
    select: { id: true, name: true },
  });

  if (!serviceType) {
    throw new NotFoundException('Service type not found');
  }

  const AUTO_SUBSERVICE_TYPES = ['HALL', 'SOUND'];
  const isAutoType = AUTO_SUBSERVICE_TYPES.includes(
    serviceType.name.toUpperCase(),
  );

  // HALL/SOUND: تُتجاهل الخدمات الفرعية تماماً.
  // غير ذلك: نُنشئ فرعية فقط إن أُرسلت، وإلا نتركها للمرحلة الثانية بعد القبول.
  const subServiceCreate =
    !isAutoType && dto.subService
      ? {
          name: dto.subService.name,
          description: dto.subService.description,
          pricePerUnit: dto.subService.pricePerUnit,
          unitType: dto.subService.unitType,
          dailyCapacity: dto.subService.dailyCapacity,
        }
      : undefined;

  // ==========================================================
  // 1) كل عمليات الرفع تتم أولاً — خارج الـ transaction
  // ==========================================================
  let serviceLogoUrl: string | null = null;
  if (serviceLogo) {
    const uploaded = await this.cloudinaryService.upload(serviceLogo, {
      folder: 'eventy/services',
    });
    serviceLogoUrl = uploaded.url;
  }

  let businessFileUrl: string | null = null;
  if (businessFile) {
    const uploaded = await this.cloudinaryService.upload(businessFile, {
      folder: 'eventy/business-files',
    });
    businessFileUrl = uploaded.url;
  }

  // نرفع وسائط الفرعية فقط إن كنا فعلاً سننشئ خدمة فرعية
  const uploadedSubServiceMedia: { url: string; publicId: string }[] = [];
  if (subServiceCreate && subServiceMedia?.length) {
    for (const file of subServiceMedia) {
      const uploaded = await this.cloudinaryService.upload(file, {
        folder: 'eventy/sub-services',
      });
      uploadedSubServiceMedia.push({
        url: uploaded.url,
        publicId: uploaded.publicId,
      });
    }
  }

  // ==========================================================
  // 2) كل كتابات DB داخل transaction واحدة (ذرّية)
  // ==========================================================
  const service = await this.prisma.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        providerId: user.provider.id,
        serviceTypeId: dto.serviceTypeId,
        description: dto.description,
        minCapacity: dto.minCapacity,
        maxCapacity: dto.maxCapacity,
        serviceLogo: serviceLogoUrl,
        businessFile: businessFileUrl,
        price: dto.price,
        isPackaged: dto.isPackaged ?? false,
        eventTypes: {
          create: dto.eventTypes.map((type) => ({
            eventType: type,
          })),
        },
        subServices: subServiceCreate
          ? { create: subServiceCreate }
          : undefined,
      },
      include: {
        serviceType: { select: { name: true } },
        eventTypes: { select: { eventType: true } },
        availability: {
          include: { workingDays: true, timeSlots: true },
        },
        subServices: true,
      },
    });

    // وسائط الفرعية فقط إن وُجدت فرعية ووصلت ملفات
    const subService = created.subServices[0];
    if (subService && uploadedSubServiceMedia.length) {
      await tx.subServiceMedia.createMany({
        data: uploadedSubServiceMedia.map((m) => ({
          subServiceId: subService.id,
          url: m.url,
          publicId: m.publicId,
          type: FileType.IMAGE,
        })),
      });
    }

    await tx.serviceChangeRequest.create({
      data: {
        targetType: 'SERVICE',
        targetId: created.id,
        requestType: 'CREATE',
        payload: dto as unknown as object,
        status: 'PENDING',
      },
    });

    return created;
  });

  return {
    message: 'Service created successfully and pending approval',
    data: service,
  };
}
  // ========================
  // 📋 Get My Services
  // ========================
  async getMyServices(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const services = await this.prisma.service.findMany({
      where: { providerId: user.provider.id },
      include: {
        subServices: true,
        eventTypes: true,
        availability: {
          include: { timeSlots: true },
        },
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Services retrieved successfully',
      data: services,
    };
  }

  // ========================
  // 📄 Get Service By ID
  // ========================
  // src/modules/services/services.service.ts
async getServiceById(
  userId: string,
  serviceId: string,
  query: ServiceDetailQueryDto,
) {
  const { filesPage = 1, filesLimit = 5, subsPage = 1, subsLimit = 10 } = query;
  const filesSkip = (filesPage - 1) * filesLimit;
  const subsSkip  = (subsPage  - 1) * subsLimit;

  const DAY_NAMES: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

  const dayOfWeek: DayOfWeek | undefined = query.date? DAY_NAMES[new Date(query.date).getDay()]: undefined;
  
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { provider: true },
  });
  if (!user) throw new NotFoundException('User not found');

  const service = await this.prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      // ✅ اسم النوع
      serviceType: { select: { name: true } },

      // ✅ أنواع المناسبات
      eventTypes: { select: { eventType: true } },

      // ✅ الملفات مع pagination
      files: {
        skip: filesSkip,
        take: filesLimit,
        orderBy: { uploadedAt: 'desc' },
      },

      // ✅ الإتاحة مع أيام العمل
      availability: {
        where: dayOfWeek? { workingDays: { some: { dayOfWeek } } }: undefined,
        include: {
          timeSlots: true,
          workingDays: { where: dayOfWeek ? { dayOfWeek } : undefined,
            select: { dayOfWeek: true }, },
        },
      },

      // ✅ الخدمات الفرعية مع pagination
      subServices: {
        where: { isAvailable: true, approvalStatus: 'ACTIVE' },
        skip: subsSkip,
        take: subsLimit,
        include: { media: true },
        orderBy: { createdAt: 'asc' },
      },

      provider: {
        include: {
          user: {
            select: {
              fullName:     true,
              profileImage: true,
              phoneNumber:  true,
              locationName: true,
            },
          },
        },
      },
    },
  });

  if (!service) throw new NotFoundException('Service not found');

  // ── Authorization ──────────────────────────────────────────
  const isAdmin   = user.role === 'ADMIN';
  const isOwner   = user.provider?.id === service.providerId;
  // package-exclusive services are never independently visible, even to a
  // customer who guesses/shares the URL (docs/packages-implementation-plan.md §6)
  const isPublic  = service.approvalStatus === 'ACTIVE' && !service.isPackaged;

  if (!isAdmin && !isOwner && !isPublic) {
    throw new NotFoundException('Service not found');
  }

  // ── ALL_EVENTS logic ───────────────────────────────────────
  const hasAllEvents = service.eventTypes.some(
    (e) => e.eventType === 'ALL_EVENTS',
  );
  const eventTypes = hasAllEvents
    ? [{ eventType: 'ALL_EVENTS' as const }]
    : service.eventTypes;

  // ── Pagination meta ────────────────────────────────────────
  const [filesTotal, subsTotal] = await this.prisma.$transaction([
    this.prisma.serviceDetailFile.count({ where: { serviceId } }),
    this.prisma.subService.count({ where: { serviceId, isAvailable: true, approvalStatus: 'ACTIVE' } }),
  ]);

// Owner/admin see every active discount, including code-gated ones — they
  // need visibility into all their own promotions. Everyone else (public
  // customer view) only sees discounts that apply automatically, mirroring
  // getAvailableServicesByType's browse behaviour.
  const discount =
    isAdmin || isOwner
      ? (await this.discountsService.getAllActiveDiscountsForServices([serviceId])).get(serviceId) ?? null
      : await this.discountsService.resolveActiveDiscountForService(serviceId);
  const { eventTypes: _et, ...rest } = this.decorateServiceWithDiscount(service, discount);

  return {
    message: 'Service retrieved successfully',
    data: {
      ...rest,
      eventTypes,
      meta: {
        files: {
          total:      filesTotal,
          page:       filesPage,
          limit:      filesLimit,
          totalPages: Math.ceil(filesTotal / filesLimit),
        },
        subServices: {
          total:      subsTotal,
          page:       subsPage,
          limit:      subsLimit,
          totalPages: Math.ceil(subsTotal / subsLimit),
        },
      },
    },
  };
}
  // ========================
  // ✏️ Update Service
  // ========================
  async updateService(
    userId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { availability: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.providerId !== user.provider.id) {
      throw new ForbiddenException('Access denied');
    }

    // ✅ Validation
    if (
      dto.minCapacity !== undefined &&
      dto.maxCapacity !== undefined &&
      dto.minCapacity > dto.maxCapacity
    ) {
      throw new BadRequestException(
        'minCapacity cannot be greater than maxCapacity',
      );
    }

    if (
      dto.workFromTime !== undefined &&
      dto.workToTime !== undefined &&
      dto.workFromTime >= dto.workToTime
    ) {
      throw new BadRequestException(
        'workFromTime must be earlier than workToTime',
      );
    }

    if (service.approvalStatus !== 'ACTIVE') {
      throw new BadRequestException(
        `Service cannot be edited while it is ${service.approvalStatus}`,
      );
    }

    const engaged = await this.engagementService.hasActiveEngagement(
      'SERVICE',
      serviceId,
    );
    if (engaged) {
      throw new BadRequestException(
        'Cannot request an update while the service has an active engagement (confirmed/in-progress booking on a live event)',
      );
    }

    const changeRequest = await this.prisma.$transaction(async (tx) => {
      const cr = await tx.serviceChangeRequest.create({
        data: {
          targetType: 'SERVICE',
          targetId: serviceId,
          requestType: 'UPDATE',
          payload: dto as unknown as object,
          status: 'PENDING',
        },
      });

      await tx.service.update({
        where: { id: serviceId },
        data: { approvalStatus: 'PENDING_APPROVAL' },
      });

      return cr;
    });

    return {
      message: 'Update request submitted for admin review',
      data: {
        serviceId,
        changeRequestId: changeRequest.id,
        approvalStatus: 'PENDING_APPROVAL',
      },
    };
  }

  // ========================
  // 🗑️ Delete Service
  // ========================
  // docs/packages-implementation-plan.md §10 — deleting a public service that's
  // attached to one or more of the same provider's packages cascades out of
  // them, re-validates each package's composition, and notifies the provider.
  async deleteService(userId: string, serviceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { serviceType: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.providerId !== user.provider.id) {
      throw new ForbiddenException('Access denied');
    }


    const activeBooking = await this.prisma.booking.findFirst({
      where: { serviceId, status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
    });
    if (activeBooking) {
      throw new BadRequestException('Cannot delete a service with active bookings');
    }

    await this.prisma.service.delete({
      where: { id: serviceId },
    });

    return {
      message: 'Service deleted successfully',
      data: null,
    };
  }


  // ========================
  //  Available Services
  // ========================
// src/modules/services/services.service.ts
  async getAvailableServicesByType(dto: AvailableServicesQueryDto) {
    const { type, date, guests, budget, page = 1, limit = 10,search } = dto;
    const skip = (page - 1) * limit;

    // ── Validation ──────────────────────────────────────────────
    if (budget && !guests) {
      throw new BadRequestException(
        'guests is required when budget is provided',
      );
    }

    // ── Base filters (always applied) ───────────────────────────
    const isDefaultSearch = !dto.status;

    const where: any = {
      approvalStatus: dto.status ?? 'ACTIVE',   // ← إذا ما في status → ACTIVE
      // package-exclusive services never appear in public search/browse
      // (docs/packages-implementation-plan.md §1, §6)
      isPackaged: false,
    };

    if (isDefaultSearch) {
      where.isCompleted = true;             // ← فقط عند البحث الافتراضي للزبون
    }
    // ── Optional simple filters ──────────────────────────────────
    if (type) {
      where.serviceType = { name: type.toUpperCase() };
    }

    if (search) {
      where.provider = { businessName: { contains: search, mode: 'insensitive' } };
    }

    
    // ── AND conditions (OR-based filters that must not conflict) ─
    const andConditions: any[] = [];

if (date) {
  const DAY_NAMES = [
    'SUNDAY','MONDAY','TUESDAY','WEDNESDAY',
    'THURSDAY','FRIDAY','SATURDAY',
  ];
  const dayOfWeek = DAY_NAMES[new Date(date).getDay()];
  where.availability = {
    some: { workingDays: { some: { dayOfWeek } } },
  };

  // ── استثناء الخدمات المحجوبة (Blocked Slots) في هذا التاريخ ──
  const MOSTLY_BLOCKED_HOURS = 8;
  const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

  const blocksOnDate = await this.prisma.blockedSlot.findMany({
    where: { date: { gte: startOfDay, lte: endOfDay } },
    select: { serviceId: true, providerId: true, fromTime: true, toTime: true },
  });

  const isMostlyBlocked = (b: { fromTime: string | null; toTime: string | null }) => {
    if (!b.fromTime || !b.toTime) return true;
    const [fh, fm] = b.fromTime.split(':').map(Number);
    const [th, tm] = b.toTime.split(':').map(Number);
    const durationHours = (th * 60 + tm - (fh * 60 + fm)) / 60;
    return durationHours >= MOSTLY_BLOCKED_HOURS;
  };

  const excludedServiceIds = new Set<string>();
  const excludedProviderIds = new Set<string>();
  for (const b of blocksOnDate) {
    if (!isMostlyBlocked(b)) continue;
    if (b.serviceId) excludedServiceIds.add(b.serviceId);
    else excludedProviderIds.add(b.providerId);
  }

  if (excludedServiceIds.size > 0) {
    andConditions.push({ id: { notIn: [...excludedServiceIds] } });
  }
  if (excludedProviderIds.size > 0) {
    andConditions.push({ providerId: { notIn: [...excludedProviderIds] } });
  }
}

    if (guests) {
      andConditions.push({
        OR: [
          { maxCapacity: null },           // no limit set → always fits
          { maxCapacity: { gte: guests } },
        ],
      });
    }

    if (budget && guests) {
      andConditions.push({
        OR: [
          // ── Hall / Sound: direct price on the service ──────────
          {
            price:       { lte: budget },
            subServices: { none: {} },
          },

          // ── ITEM sub-services: pricePerUnit × guests <= budget ─
          // → equivalent to: pricePerUnit <= budget ÷ guests
          {
            subServices: {
              some: {
                isAvailable:  true,
                approvalStatus: 'ACTIVE',
                unitType:     'ITEM',
                pricePerUnit: { lte: budget / guests },
              },
            },
          },

          // ── SESSION sub-services: flat rate, guests-independent ─
          {
            subServices: {
              some: {
                isAvailable:  true,
                approvalStatus: 'ACTIVE',
                unitType:     'SESSION',
                pricePerUnit: { lte: budget },
              },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // ── Query ────────────────────────────────────────────────────
    const [services, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { rating: 'desc' },
        include: {
          serviceType: { select: { name: true } },
          eventTypes:  { select: { eventType: true } },
          files:       { take: 1 },
          provider: {
            include: {
              user: {
                select: {
                  fullName:     true,
                  profileImage: true,
                  locationName: true,
                  phoneNumber:  true,
                },
              },
            },
          },
          subServices: {
            where:   { isAvailable: true, approvalStatus: 'ACTIVE' },
            select: {
              id:           true,
              name:         true,
              pricePerUnit: true,
              unitType:     true,
              dailyCapacity: true,
            },
          },
          availability: {
            include: { workingDays: true, timeSlots: true },
          },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    const discountMap = await this.discountsService.getActiveAutoDiscountsForServices(services.map((s) => s.id));
    const items = services.map((s) => this.decorateServiceWithDiscount(s, discountMap.get(s.id) ?? null));

    return {
      message:
        total > 0
          ? 'Available services retrieved successfully'
          : 'No available services found matching the given criteria',
      data: {
        items,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    };
  }
  // ========================
  //  Services types CRUD
  // ========================
// ── الدالة الأولى ──────────────────────────────────────
async getAllServiceTypes() {
  const types = await this.prisma.serviceType.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { services: true } },
    },
  });

  return {
    message: 'Service types retrieved successfully',
    data: types,
  };
}

// ── الدالة الثانية ─────────────────────────────────────
async createServiceType(dto: CreateServiceTypeDto) {
  const existing = await this.prisma.serviceType.findUnique({
    where: { name: dto.name.toUpperCase() },
  });

  if (existing) {
    throw new ConflictException(
      `Service type '${dto.name}' already exists`,
    );
  }

  const type = await this.prisma.serviceType.create({
    data: {
      name: dto.name.toUpperCase(),
      description: dto.description,
    },
  });

  return {
    message: 'Service type created successfully',
    data: type,
  };
}

// ── تحديث نوع خدمة (isVenue / requiresDeliveryByDefault) ──
async updateServiceType(typeId: string, dto: { description?: string; isVenue?: boolean; requiresDeliveryByDefault?: boolean }) {
  const type = await this.prisma.serviceType.findUnique({ where: { id: typeId } });
  if (!type) throw new NotFoundException('Service type not found');

  const updated = await this.prisma.serviceType.update({
    where: { id: typeId },
    data: {
      description: dto.description,
      isVenue: dto.isVenue,
      requiresDeliveryByDefault: dto.requiresDeliveryByDefault,
    },
  });

  return { message: 'Service type updated successfully', data: updated };
}

// ── الدالة الثالثة ─────────────────────────────────────
async deleteServiceType(typeId: string) {
  const type = await this.prisma.serviceType.findUnique({
    where: { id: typeId },
    include: {
      _count: { select: { services: true } },
    },
  });

  if (!type) {
    throw new NotFoundException('Service type not found');
  }

  if (type._count.services > 0) {
    throw new BadRequestException(
      `Cannot delete '${type.name}' — it is used by ${type._count.services} service(s)`,
    );
  }

  await this.prisma.serviceType.delete({ where: { id: typeId } });

  return {
    message: 'Service type deleted successfully',
    data: null,
  };
}

/** Shared service + sub-service price decoration reused by list and detail. */
   decorateServiceWithDiscount(service: any, discount: Discount | null) {
    const pricing =
      service.price != null
        ? this.discountsService.computePriceWithDiscount(service.price, discount)
        : {
            originalPrice: null,
            finalPrice: null,
            discountAmount: 0,
            discount: discount ? this.discountsService.toSummary(discount) : null,
          };

    const subServices = service.subServices?.map((sub: any) => ({
      ...sub,
      ...this.discountsService.computePriceWithDiscount(sub.pricePerUnit, discount),
    }));
     return { ...service, ...pricing, ...(subServices ? { subServices } : {}) };
  }
}