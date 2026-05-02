import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ➕ API #9: POST Create New Service
   */
  async createService(userId: string, dto: CreateServiceDto) {
    // 1. جلب Provider
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        provider: true,
      },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    // 2. إنشاء Service
    const service = await this.prisma.service.create({
      data: {
        providerId: user.provider.id,
        serviceType: dto.serviceType,
        eventTypes: dto.eventTypes,
        description: dto.description,

        // Availability
        availableFrom: dto.availableFrom,
        availableTo: dto.availableTo,
        dailyCapacity: dto.dailyCapacity,
        capacityUnit: dto.capacityUnit,

        // Optional
        useTimeSlots: dto.useTimeSlots || false,
        minCapacity: dto.minCapacity,
        maxCapacity: dto.maxCapacity,
        price: dto.price,

        // Status
        approvalStatus: 'PENDING',

        // Time Slots (إن وُجدت)
        timeSlots: dto.timeSlots
          ? {
              createMany: {
                data: dto.timeSlots.map((slot) => ({
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  capacity: slot.capacity,
                })),
              },
            }
          : undefined,
      },
      include: {
        timeSlots: true,
        subServices: true,
      },
    });

    return {
      message: 'Service created successfully and pending approval',
      data: service,
    };
  }

  /**
   * 📋 API #10: GET All My Services
   */
  async getMyServices(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        provider: true,
      },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const services = await this.prisma.service.findMany({
      where: { providerId: user.provider.id },
      include: {
        subServices: true,
        timeSlots: true,
        _count: {
          select: {
            bookings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Services retrieved successfully',
      data: services.map((service) => ({
        id: service.id,
        serviceType: service.serviceType,
        eventTypes: service.eventTypes,
        description: service.description,

        availableFrom: service.availableFrom,
        availableTo: service.availableTo,
        dailyCapacity: service.dailyCapacity,
        capacityUnit: service.capacityUnit,

        useTimeSlots: service.useTimeSlots,
        timeSlots: service.timeSlots,

        minCapacity: service.minCapacity,
        maxCapacity: service.maxCapacity,
        price: service.price,

        isActive: service.isActive,
        isClosedToday: service.isClosedToday,
        approvalStatus: service.approvalStatus,

        subServicesCount: service.subServices.length,
        bookingsCount: service._count.bookings,

        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      })),
    };
  }

  /**
   * 📄 Get Single Service by ID
   */
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
        timeSlots: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // تحقق من أن الخدمة تعود للـ Provider
    if (service.providerId !== user.provider.id) {
      throw new ForbiddenException('Access denied');
    }

    return {
      message: 'Service retrieved successfully',
      data: service,
    };
  }

  /**
   * ✏️ Update Service
   */
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
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.providerId !== user.provider.id) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        eventTypes: dto.eventTypes,
        description: dto.description,
        availableFrom: dto.availableFrom,
        availableTo: dto.availableTo,
        dailyCapacity: dto.dailyCapacity,
        capacityUnit: dto.capacityUnit,
        useTimeSlots: dto.useTimeSlots,
        minCapacity: dto.minCapacity,
        maxCapacity: dto.maxCapacity,
        price: dto.price,
        isActive: dto.isActive,
        isClosedToday: dto.isClosedToday,
      },
      include: {
        subServices: true,
        timeSlots: true,
      },
    });

    return {
      message: 'Service updated successfully',
      data: updated,
    };
  }

  /**
   * 🗑️ Delete Service
   */
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
}