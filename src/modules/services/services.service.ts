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
import { FileType } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService,
        private readonly cloudinaryService: CloudinaryService,

  ) {}

  // ========================
  // ➕ Create Service
  // ========================
  async createService(userId: string, dto: CreateServiceDto,
     files: {
    serviceMedia?: Express.Multer.File[];
    subServiceMedia?: Express.Multer.File[];
            },
    ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const service = await this.prisma.service.create({
      data: {
        providerId: user.provider.id,
        serviceTypeId: dto.serviceTypeId,
        description: dto.description,

        minCapacity: dto.minCapacity,
        maxCapacity: dto.maxCapacity,
        price: dto.price,

        ...(dto.locationName !== undefined && { locationName: dto.locationName }),
        ...(dto.latitude    !== undefined && { latitude:     dto.latitude    }),
        ...(dto.longitude   !== undefined && { longitude:    dto.longitude   }),
        eventTypes: {
          create: dto.eventTypes.map((type) => ({
            eventType: type,
          })),
        },
         availability: {
          create: dto.availability.map((day) => ({
            workFromTime: day.workFromTime,
            workToTime: day.workToTime,
            capacity: day.capacity,
            hasSlots: day.hasSlots ?? false,
            workingDays: {
            create: { dayOfWeek: day.dayOfWeek },
          },
            timeSlots:
              day.timeSlots?.length
                ? {
                    create: day.timeSlots.map((slot) => ({
                      fromTime: slot.fromTime,
                      toTime: slot.toTime,
                      capacity: slot.capacity,
                    })),
                  }
                : undefined,
          })),
        },
                
        subServices: {
          create: {
            name: dto.subService.name,

            description: dto.subService.description,

            pricePerUnit: dto.subService.pricePerUnit,

            unitType: dto.subService.unitType,

            dailyCapacity: dto.subService.dailyCapacity,
          },
        },
         
              },
      include: {
      serviceType:  { select: { name: true } },
      eventTypes:   { select: { eventType: true } },
        availability: {
          include: { workingDays: true,timeSlots: true },
        },
        subServices: true,
      },
    });

    for (const file of files.serviceMedia ?? []) {

      const uploaded = await this.cloudinaryService.upload(
        file,
        {
          folder: 'eventy/services',
        },
      );

       await this.prisma.serviceDetailFile.create({
    data: {

      serviceId: service.id,

      fileUrl: uploaded.url,

      publicId: uploaded.publicId,

      fileType: FileType.IMAGE,
    },
  });
}

  const subService = service.subServices[0];

  for (const file of files.subServiceMedia ?? []) {

    const uploaded =
      await this.cloudinaryService.upload(
        file,{
        folder: 'eventy/sub-services',}
      );

    await this.prisma.subServiceMedia.create({

      data: {

        subServiceId: subService.id,

        url: uploaded.url,

        publicId: uploaded.publicId,

        type: FileType.IMAGE,

      },

    });

  }
    
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
        include: {
          timeSlots: true,
          workingDays: { select: { dayOfWeek: true } },
        },
      },

      // ✅ الخدمات الفرعية مع pagination
      subServices: {
        where: { isAvailable: true },
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
  const isPublic  = service.approvalStatus === 'ACTIVE';

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
    this.prisma.subService.count({ where: { serviceId, isAvailable: true } }),
  ]);

  const { eventTypes: _et, ...rest } = service;

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

    const updated = await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        description: dto.description,
        minCapacity: dto.minCapacity,
        maxCapacity: dto.maxCapacity,
        price: dto.price,

        // ✅ EventTypes
        eventTypes: dto.eventTypes
          ? {
              deleteMany: {},
              create: dto.eventTypes.map((type) => ({
                eventType: type,
              })),
            }
          : undefined,

        // ✅ FIX: updateMany مع where + partial update
        availability:
          dto.workFromTime !== undefined ||
          dto.workToTime !== undefined ||
          dto.hasSlots !== undefined
            ? {
                updateMany: {
                  where: { serviceId: serviceId }, // ✅ حل الخطأ
                  data: {
                    ...(dto.workFromTime !== undefined && {
                      workFromTime: dto.workFromTime,
                    }),
                    ...(dto.workToTime !== undefined && {
                      workToTime: dto.workToTime,
                    }),
                    ...(dto.hasSlots !== undefined && {
                      hasSlots: dto.hasSlots,
                    }),
                  },
                },
              }
            : undefined,
      },
      include: {
        availability: {
          include: { timeSlots: true },
        },
        eventTypes: true,
        subServices: true,
      },
    });

    // ✅ FIX: timeSlots بدون أخطاء
    if (dto.timeSlots && service.availability.length > 0) {
      const availabilityId = service.availability[0].id;

      await this.prisma.timeSlot.deleteMany({
        where: { availabilityId },
      });

      await this.prisma.timeSlot.createMany({
        data: dto.timeSlots.map((slot) => ({
          ...slot,
          availabilityId,
        })),
      });
    }

    return {
      message: 'Service updated successfully',
      data: updated,
    };
  }

  // ========================
  // 🗑️ Delete Service
  // ========================
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
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.providerId !== user.provider.id) {
      throw new ForbiddenException('Access denied');
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
    const { type, date, guests, budget, page = 1, limit = 10 } = dto;
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
    };

    if (isDefaultSearch) {
      where.isCompleted = true;             // ← فقط عند البحث الافتراضي للزبون
    }
    // ── Optional simple filters ──────────────────────────────────
    if (type) {
      where.serviceType = { name: type.toUpperCase() };
    }

    if (date) {
      const DAY_NAMES = [
        'SUNDAY','MONDAY','TUESDAY','WEDNESDAY',
        'THURSDAY','FRIDAY','SATURDAY',
      ];
      const dayOfWeek = DAY_NAMES[new Date(date).getDay()];
      where.availability = {
        some: { workingDays: { some: { dayOfWeek } } },
      };
    }

    // ── AND conditions (OR-based filters that must not conflict) ─
    const andConditions: any[] = [];

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
            where:   { isAvailable: true },
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

    return {
  message:
    total > 0
      ? 'Available services retrieved successfully'
      : 'No available services found matching the given criteria',
      data: {
        items: services,
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

}