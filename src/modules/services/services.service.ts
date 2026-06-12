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

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================
  // ➕ Create Service
  // ========================
  async createService(userId: string, dto: CreateServiceDto) {
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

        eventTypes: {
          create: dto.eventTypes.map((type) => ({
            eventType: type,
          })),
        },

        availability: {
          create: {
            workFromTime: dto.workFromTime,
            workToTime: dto.workToTime,
            hasSlots: dto.hasSlots ?? false,

            timeSlots: dto.timeSlots
              ? {
                  create: dto.timeSlots,
                }
              : undefined,
          },
        },
      },
      include: {
        eventTypes: true,
        availability: {
          include: { timeSlots: true },
        },
        subServices: true,
      },
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
  async getServiceById(userId: string, serviceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        subServices: true,
        eventTypes: true,
        availability: {
          include: { timeSlots: true },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.providerId !== user.provider.id) {
      throw new ForbiddenException('Access denied');
    }

    return {
      message: 'Service retrieved successfully',
      data: service,
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
  async getAvailableServicesByType(
    type: string,
    date?: string,
  ) {
    // TODO: Get available services filtered by service type and availability date
    return {
      message: 'Get available services by type is not implemented yet',
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