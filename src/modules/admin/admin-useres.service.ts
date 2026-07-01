// src/modules/admin/admin-useres.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { EngagementService } from 'src/shared/services/engagement.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Injectable()
export class AdminUseresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engagementService: EngagementService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // PATCH /admin-users/users/:userId/block
  // ─────────────────────────────────────────────────────────────
  async blockUser(adminId: string, userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot block an admin account');
    }
    if (user.status === 'SUSPENDED') {
      throw new BadRequestException('User is already blocked');
    }

    const engaged = await this.engagementService.hasActiveEngagement('USER', userId);
    if (engaged) {
      throw new BadRequestException(
        'Cannot block a user with an active engagement (confirmed/in-progress booking on a live event)',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });

    this.domainEventBus.userBlocked({
      actorId: adminId,
      targetUserId: userId,
      entityId: userId,
      reason,
    });

    return {
      message: 'User blocked successfully',
      data: { userId, status: 'SUSPENDED' },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PATCH /admin-users/users/:userId/unblock
  // ─────────────────────────────────────────────────────────────
  async unblockUser(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'SUSPENDED') {
      throw new BadRequestException('User is not blocked');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    this.domainEventBus.userUnblocked({
      actorId: adminId,
      targetUserId: userId,
      entityId: userId,
    });

    return {
      message: 'User unblocked successfully',
      data: { userId, status: 'ACTIVE' },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PATCH /admin-users/providers/:providerId/block
  // ─────────────────────────────────────────────────────────────
  async blockProvider(adminId: string, providerId: string, reason?: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id: providerId },
      include: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.user.status === 'SUSPENDED') {
      throw new BadRequestException('Provider is already blocked');
    }

    const engaged = await this.engagementService.hasActiveEngagement('PROVIDER', providerId);
    if (engaged) {
      throw new BadRequestException(
        'Cannot block a provider with an active engagement (confirmed/in-progress booking on a live event)',
      );
    }

    await this.prisma.user.update({
      where: { id: provider.userId },
      data: { status: 'SUSPENDED' },
    });

    this.domainEventBus.userBlocked({
      actorId: adminId,
      targetUserId: provider.userId,
      entityId: providerId,
      reason,
    });

    return {
      message: 'Provider blocked successfully',
      data: { providerId, userId: provider.userId, status: 'SUSPENDED' },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PATCH /admin-users/providers/:providerId/unblock
  // ─────────────────────────────────────────────────────────────
  async unblockProvider(adminId: string, providerId: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id: providerId },
      include: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.user.status !== 'SUSPENDED') {
      throw new BadRequestException('Provider is not blocked');
    }

    await this.prisma.user.update({
      where: { id: provider.userId },
      data: { status: 'ACTIVE' },
    });

    this.domainEventBus.userUnblocked({
      actorId: adminId,
      targetUserId: provider.userId,
      entityId: providerId,
    });

    return {
      message: 'Provider unblocked successfully',
      data: { providerId, userId: provider.userId, status: 'ACTIVE' },
    };
  }

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