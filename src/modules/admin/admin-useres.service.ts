// src/modules/admin/admin-useres.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@Injectable()
export class AdminUseresService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // GET /admin-users/providers/pending
  // ─────────────────────────────────────────────────────────────
  async getPendingProviders(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, order = 'desc' } = paginationDto;
    const skip = (page - 1) * limit;

    const [providers, total] = await this.prisma.$transaction([
      this.prisma.serviceProvider.findMany({
        where: { approvalStatus: 'PENDING' },
        skip,
        take: limit,
        orderBy: { user: { createdAt: order } },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              profileImage: true,
              locationName: true,
              emailVerified: true,
              createdAt: true,
            },
          },
          services: {
            take: 1,
            include: {
              serviceType: { select: { name: true } },
              eventTypes: { select: { eventType: true } },
              files: { take: 1, select: { fileUrl: true, fileType: true } },
            },
          },
        },
      }),
      this.prisma.serviceProvider.count({ where: { approvalStatus: 'PENDING' } }),
    ]);

    return {
      message: 'Pending providers retrieved successfully',
      data: {
        items: providers,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GET /admin-users/providers/:providerId
  // ─────────────────────────────────────────────────────────────
  async getProviderDetails(providerId: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id: providerId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            profileImage: true,
            locationName: true,
            latitude: true,
            longitude: true,
            status: true,
            emailVerified: true,
            createdAt: true,
            bankAccount: {
              select: {
                iban: true,
                bankName: true,
                accountHolderName: true,
                isVerified: true,
              },
            },
          },
        },
        services: {
          include: {
            serviceType: true,
            eventTypes: { select: { eventType: true } },
            files: true,
            subServices: {
              include: { media: { take: 2 } },
            },
            availability: {
              include: { workingDays: true, timeSlots: true },
            },
          },
        },
      },
    });

    if (!provider) throw new NotFoundException('Provider not found');

    return {
      message: 'Provider details retrieved successfully',
      data: provider,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GET /admin-users/getAllBookings
  // ─────────────────────────────────────────────────────────────
  async getAllBookings(filters: {
    providerId?: string;
    customerId?: string;
    status?: BookingStatus;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, ...where } = filters;

    // يبني where ديناميكياً من الـ filters
    const condition: any = {};
    if (where.providerId) condition.providerId = where.providerId;
    if (where.customerId) condition.customerId = where.customerId;
    if (where.status)     condition.status     = where.status;

    const [bookings, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where: condition,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          event:    { select: { name: true, eventDate: true } },
          service:  { include: { serviceType: { select: { name: true } } } },
          customer: { select: { fullName: true, email: true } },
          provider: { include: { user: { select: { fullName: true } } } },
        },
      }),
      this.prisma.booking.count({ where: condition }),
    ]);

    return {
      message: 'Bookings retrieved successfully',
      data: {
        items: bookings,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    };
  }
}