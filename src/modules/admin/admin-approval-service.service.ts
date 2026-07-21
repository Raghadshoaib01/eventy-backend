import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/database/prisma.service';
import {
  ApproveProviderJoinDto,
  ApproveServiceDto,
  ApproveSubServiceDto,
  ApprovePackageDto,
} from './dto/ApproveProviderJoinDto';
import { ApprovalStatus } from 'src/shared/Enums/approval-status.enum';
import {
  DomainEvents,
  ProviderApprovedPayload,
  ProviderRejectedPayload,
  ServiceApprovedPayload,
  ServiceRejectedPayload,
} from 'src/common/events/domain-events';
import { PackageStatus } from '@prisma/client';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { ChangeRequestQueryDto } from './dto/change-request-query.dto';

@Injectable()
export class AdminApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 Requests Inbox: list / detail across all 4 cases
   * (new service, service update, new sub-service, sub-service update)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async listChangeRequests(query: ChangeRequestQueryDto) {
    const { page = 1, limit = 10, order = 'desc', targetType, requestType, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(targetType && { targetType }),
      ...(requestType && { requestType }),
      status: status ?? ApprovalStatus.PENDING,
    };

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.serviceChangeRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: order },
      }),
      this.prisma.serviceChangeRequest.count({ where }),
    ]);

    const items = await Promise.all(
      requests.map((r) => this.enrichChangeRequest(r)),
    );

    return {
      message: 'Change requests retrieved successfully',
      data: {
        items,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  async getChangeRequestById(id: string) {
    const request = await this.prisma.serviceChangeRequest.findUnique({
      where: { id },
    });

    if (!request) throw new NotFoundException('Change request not found');

    return {
      message: 'Change request retrieved successfully',
      data: await this.enrichChangeRequest(request),
    };
  }

  private async enrichChangeRequest(request: {
    id: string;
    targetType: string;
    targetId: string;
    requestType: string;
    payload: unknown;
    status: string;
    reviewedBy: string | null;
    reviewNote: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    let target: unknown = null;

    if (request.targetType === 'SERVICE') {
      target = await this.prisma.service.findUnique({
        where: { id: request.targetId },
        select: {
          id: true,
          approvalStatus: true,
          serviceType: { select: { name: true } },
          provider: { select: { businessName: true, userId: true } },
        },
      });
    } else {
      target = await this.prisma.subService.findUnique({
        where: { id: request.targetId },
        select: {
          id: true,
          name: true,
          pricePerUnit: true,
          approvalStatus: true,
          service: {
            select: {
              serviceType: { select: { name: true } },
              provider: { select: { businessName: true, userId: true } },
            },
          },
        },
      });
    }

    return { ...request, target };
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 Function #1: Approve/Reject a Service Provider Join Request
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async approveProviderJoin(adminId: string, dto: ApproveProviderJoinDto) {

    // 2. Fetch the service provider and their service
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id: dto.providerId },
      include: {
        user: true,
        services: {
          where: { id: dto.serviceId },
          include: {
            serviceType: true,
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const service = provider.services[0];
    if (!service) {
      throw new NotFoundException('Service not found for this provider');
    }

    // 3. Verify that the provider is in PENDING status
    if (provider.approvalStatus !== 'PENDING') {
      throw new BadRequestException(
        `Provider status is already ${provider.approvalStatus}`,
      );
    }

    // 4. Execute approval or rejection
    if (dto.isApproved) {
      // ✅ Approval
      await this.prisma.$transaction(async (tx) => {
        // Update provider status to APPROVED
        await tx.serviceProvider.update({
          where: { id: dto.providerId },
          data: {
            approvalStatus: ApprovalStatus.APPROVED,
          },
        });

        // Update service status to PENDING_DETAILS
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'PENDING_DETAILS',
          },
        });

        // Update user status to ACTIVE
        await tx.user.update({
          where: { id: provider.userId },
          data: {
            status: 'ACTIVE',
          },
        });
      });

      this.domainEventBus.providerApproved({
  actorId: adminId,
  targetUserId: provider.userId,
  entityId: provider.id,
  providerId: provider.id,
  businessName: provider.businessName,
  adminMessage: dto.adminMessage,
});

      return {
        message: 'Provider approved successfully',
        data: {
          providerId: provider.id,
          providerName: provider.businessName,
          serviceId: service.id,
          serviceName: service.serviceType.name,
          approvalStatus: ApprovalStatus.APPROVED,
          nextStep: 'Provider should complete service details',
        },
      };
    } else {
      // ❌ Rejection
      await this.prisma.$transaction(async (tx) => {
        // Update provider status to REJECTED
        await tx.serviceProvider.update({
          where: { id: dto.providerId },
          data: {
            approvalStatus: ApprovalStatus.REJECTED,
          },
        });

        // Update service status to REJECTED
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'REJECTED',
          },
        });

        // Update user status to SUSPENDED
        await tx.user.update({
          where: { id: provider.userId },
          data: {
            status: 'SUSPENDED',
          },
        });
      });

   this.domainEventBus.providerRejected({
  actorId: adminId,
  targetUserId: provider.userId,
  entityId: provider.id,
  providerId: provider.id,
  businessName: provider.businessName,
  adminMessage: dto.adminMessage,
});

      return {
        message: 'Provider rejected',
        data: {
          providerId: provider.id,
          providerName: provider.businessName,
          approvalStatus: ApprovalStatus.REJECTED,
          adminMessage: dto.adminMessage || null,
        },
      };
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 Function #2: Approve/Reject a New Service (ServiceChangeRequest CREATE)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async approveService(adminId: string, dto: ApproveServiceDto) {
    // 1. Fetch the pending CREATE change request for this service
    const changeRequest = await this.prisma.serviceChangeRequest.findFirst({
      where: {
        targetType: 'SERVICE',
        targetId: dto.serviceId,
        requestType: 'CREATE',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!changeRequest) {
      throw new NotFoundException(
        'No pending creation request found for this service',
      );
    }

    // 2. Fetch the service along with its sub-services
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: {
        serviceType: true,
        provider: {
          include: {
            user: true,
          },
        },
        subServices: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // 3. Execute approval or rejection
    if (dto.isApproved) {
      // ✅ Approval → PENDING_DETAILS (provider must complete details next)
      await this.prisma.$transaction(async (tx) => {
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'PENDING_DETAILS',
          },
        });

        // Delete rejected sub-services
        if (dto.rejectedSubServiceIds && dto.rejectedSubServiceIds.length > 0) {
          await tx.subService.deleteMany({
            where: {
              id: { in: dto.rejectedSubServiceIds },
              serviceId: dto.serviceId,
            },
          });
        }
        // Update approved sub-services
        if (dto.approvedSubServiceIds && dto.approvedSubServiceIds.length > 0) {
          await tx.subService.updateMany({
            where: {
              id: { in: dto.approvedSubServiceIds },
              serviceId: dto.serviceId,
            },
            data: {
              isAvailable: true,
              approvalStatus: 'ACTIVE',
            },
          });
        }

        await tx.serviceChangeRequest.update({
          where: { id: changeRequest.id },
          data: {
            status: 'APPROVED',
            reviewedBy: adminId,
            reviewNote: dto.adminMessage,
          },
        });
      });

      // Sub-service approval statistics
      const approvedCount = dto.approvedSubServiceIds?.length || 0;
      const rejectedCount = dto.rejectedSubServiceIds?.length || 0;

this.domainEventBus.serviceApproved({
  actorId: adminId,
  targetUserId: service.provider.userId,
  entityId: service.id,
  serviceId: service.id,
  serviceName: service.serviceType.name,
  adminMessage: dto.adminMessage,
});

      return {
        message: 'Service approved successfully',
        data: {
          serviceId: service.id,
          serviceName: service.serviceType.name,
          approvalStatus: 'PENDING_DETAILS',
          approvedSubServices: approvedCount,
          rejectedSubServices: rejectedCount,
          adminMessage: dto.adminMessage || null,
        },
      };
    } else {
      // ❌ Rejection
      await this.prisma.$transaction(async (tx) => {
        // Update service status to REJECTED
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'REJECTED',
          },
        });

        // Delete all sub-services
        await tx.subService.deleteMany({
          where: {
            serviceId: dto.serviceId,
          },
        });

        await tx.serviceChangeRequest.update({
          where: { id: changeRequest.id },
          data: {
            status: 'REJECTED',
            reviewedBy: adminId,
            reviewNote: dto.adminMessage,
          },
        });
      });

this.domainEventBus.serviceRejected({
  actorId: adminId,
  targetUserId: service.provider.userId,
  entityId: service.id,
  serviceId: service.id,
  serviceName: service.serviceType.name,
  adminMessage: dto.adminMessage,
});

      return {
        message: 'Service rejected',
        data: {
          serviceId: service.id,
          serviceName: service.serviceType.name,
          approvalStatus: 'REJECTED',
          adminMessage: dto.adminMessage || null,
        },
      };
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 Function #3: Approve/Reject a New Sub-Service (ServiceChangeRequest CREATE)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async approveSubService(adminId: string, dto: ApproveSubServiceDto) {
    // 1. Fetch the pending CREATE change request for this sub-service
    const changeRequest = await this.prisma.serviceChangeRequest.findFirst({
      where: {
        targetType: 'SUB_SERVICE',
        targetId: dto.subServiceId,
        requestType: 'CREATE',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!changeRequest) {
      throw new NotFoundException(
        'No pending creation request found for this sub-service',
      );
    }

    // 2. Fetch the sub-service
    const subService = await this.prisma.subService.findUnique({
      where: { id: dto.subServiceId },
      include: {
        service: {
          include: {
            serviceType: true,
            provider: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!subService) {
      throw new NotFoundException('Sub-service not found');
    }

    // 3. Execute approval or rejection
    if (dto.isApproved) {
      // ✅ Approval — activate the sub-service
      await this.prisma.$transaction(async (tx) => {
        await tx.subService.update({
          where: { id: dto.subServiceId },
          data: { isAvailable: true, approvalStatus: 'ACTIVE' },
        });

        await tx.serviceChangeRequest.update({
          where: { id: changeRequest.id },
          data: {
            status: 'APPROVED',
            reviewedBy: adminId,
            reviewNote: dto.adminMessage,
          },
        });
      });

      // TODO: Send email notification
      console.log(`
        📧 Sending welcome email to: ${subService.service.provider.user.email}

        Hello ${subService.service.provider.user.fullName},

        Your new sub-service has been approved! 🎉

        Service details:
        - Name: ${subService.name}
        - Price: ${subService.pricePerUnit} / ${subService.unitType}
        - Parent service: ${subService.service.serviceType.name}

        ${dto.adminMessage ? `Note from admin: ${dto.adminMessage}` : ''}

        Best regards,
        The Eventy Team
      `);

      return {
        message: 'Sub-service approved successfully',
        data: {
          subServiceId: subService.id,
          subServiceName: subService.name,
          status: 'ACTIVE',
          adminMessage: dto.adminMessage || null,
        },
      };
    } else {
      // ❌ Rejection — delete the sub-service
      await this.prisma.$transaction(async (tx) => {
        await tx.serviceChangeRequest.update({
          where: { id: changeRequest.id },
          data: {
            status: 'REJECTED',
            reviewedBy: adminId,
            reviewNote: dto.adminMessage,
          },
        });

        await tx.subService.delete({
          where: { id: dto.subServiceId },
        });
      });

      // TODO: Send rejection email notification
      console.log(`
        📧 Sending rejection email to: ${subService.service.provider.user.email}

        Dear ${subService.service.provider.user.fullName},

        We regret to inform you that your sub-service has been rejected.

        Service details:
        - Name: ${subService.name}
        - Parent service: ${subService.service.serviceType.name}

        ${dto.adminMessage ? `Rejection reason: ${dto.adminMessage}` : ''}

        You may update the information and resubmit your request.

        Best regards,
        The Eventy Team
      `);

      return {
        message: 'Sub-service rejected and deleted',
        data: {
          subServiceId: subService.id,
          subServiceName: subService.name,
          status: 'REJECTED',
          adminMessage: dto.adminMessage || null,
        },
      };
    }
  }
  // Approve/Reject a service update request (ServiceChangeRequest UPDATE)
async approveServiceUpdate(adminId: string, dto: ApproveServiceDto) {
  const changeRequest = await this.prisma.serviceChangeRequest.findFirst({
    where: {
      targetType: 'SERVICE',
      targetId: dto.serviceId,
      requestType: 'UPDATE',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!changeRequest) {
    throw new NotFoundException(
      'No pending update request found for this service',
    );
  }

  const service = await this.prisma.service.findUnique({
    where: { id: dto.serviceId },
    include: {
      serviceType: true,
      provider: { include: { user: true } },
      subServices: true,
      availability: true,
    },
  });

  if (!service) throw new NotFoundException('Service not found');

  if (service.approvalStatus !== 'PENDING_APPROVAL') {
    throw new BadRequestException(
      `Service is not pending update review. Current status: ${service.approvalStatus}`,
    );
  }

  const payload = changeRequest.payload as Record<string, any>;

  if (dto.isApproved) {
    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: dto.serviceId },
        data: {
          approvalStatus: 'ACTIVE',
          description: payload.description,
          minCapacity: payload.minCapacity,
          maxCapacity: payload.maxCapacity,
          price: payload.price,
          eventTypes: payload.eventTypes
            ? {
                deleteMany: {},
                create: payload.eventTypes.map((type: string) => ({ eventType: type })),
              }
            : undefined,
          availability:
            payload.workFromTime !== undefined ||
            payload.workToTime !== undefined ||
            payload.hasSlots !== undefined
              ? {
                  updateMany: {
                    where: { serviceId: dto.serviceId },
                    data: {
                      ...(payload.workFromTime !== undefined && { workFromTime: payload.workFromTime }),
                      ...(payload.workToTime !== undefined && { workToTime: payload.workToTime }),
                      ...(payload.hasSlots !== undefined && { hasSlots: payload.hasSlots }),
                    },
                  },
                }
              : undefined,
        },
      });

      if (payload.timeSlots && service.availability.length > 0) {
        const availabilityId = service.availability[0].id;
        await tx.timeSlot.deleteMany({ where: { availabilityId } });
        await tx.timeSlot.createMany({
          data: payload.timeSlots.map((slot: any) => ({ ...slot, availabilityId })),
        });
      }

      if (dto.rejectedSubServiceIds?.length) {
        await tx.subService.deleteMany({
          where: {
            id: { in: dto.rejectedSubServiceIds },
            serviceId: dto.serviceId,
          },
        });
      }

      if (dto.approvedSubServiceIds?.length) {
        await tx.subService.updateMany({
          where: {
            id: { in: dto.approvedSubServiceIds },
            serviceId: dto.serviceId,
          },
          data: { isAvailable: true, approvalStatus: 'ACTIVE' },
        });
      }

      await tx.serviceChangeRequest.update({
        where: { id: changeRequest.id },
        data: {
          status: 'APPROVED',
          reviewedBy: adminId,
          reviewNote: dto.adminMessage,
        },
      });
    });

    return {
      message: 'Service update approved successfully',
      data: {
        serviceId: service.id,
        serviceName: service.serviceType.name,
        approvalStatus: 'ACTIVE',
        approvedSubServices: dto.approvedSubServiceIds?.length ?? 0,
        rejectedSubServices: dto.rejectedSubServiceIds?.length ?? 0,
        adminMessage: dto.adminMessage ?? null,
      },
    };
  } else {
    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: dto.serviceId },
        data: { approvalStatus: 'REJECTED' },
      });

      await tx.serviceChangeRequest.update({
        where: { id: changeRequest.id },
        data: {
          status: 'REJECTED',
          reviewedBy: adminId,
          reviewNote: dto.adminMessage,
        },
      });
    });

    return {
      message: 'Service update rejected',
      data: {
        serviceId: service.id,
        serviceName: service.serviceType.name,
        approvalStatus: 'REJECTED',
        adminMessage: dto.adminMessage ?? null,
      },
    };
  }
}

// Approve/Reject a sub-service update request (ServiceChangeRequest UPDATE)
async approveSubServiceUpdate(adminId: string, dto: ApproveSubServiceDto) {
  const changeRequest = await this.prisma.serviceChangeRequest.findFirst({
    where: {
      targetType: 'SUB_SERVICE',
      targetId: dto.subServiceId,
      requestType: 'UPDATE',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!changeRequest) {
    throw new NotFoundException(
      'No pending update request found for this sub-service',
    );
  }

  const subService = await this.prisma.subService.findUnique({
    where: { id: dto.subServiceId },
    include: {
      service: {
        include: {
          serviceType: true,
          provider: { include: { user: true } },
        },
      },
    },
  });

  if (!subService) throw new NotFoundException('Sub-service not found');

  if (subService.approvalStatus !== 'PENDING_APPROVAL') {
    throw new BadRequestException(
      `Sub-service is not pending update review. Current status: ${subService.approvalStatus}`,
    );
  }

  const payload = changeRequest.payload as Record<string, any>;

  if (dto.isApproved) {
    await this.prisma.$transaction(async (tx) => {
      await tx.subService.update({
        where: { id: dto.subServiceId },
        data: {
          isAvailable: true,
          approvalStatus: 'ACTIVE',
          ...(payload.name !== undefined && { name: payload.name }),
          ...(payload.description !== undefined && { description: payload.description }),
          ...(payload.pricePerUnit !== undefined && { pricePerUnit: payload.pricePerUnit }),
          ...(payload.unitType !== undefined && { unitType: payload.unitType }),
          ...(payload.dailyCapacity !== undefined && { dailyCapacity: payload.dailyCapacity }),
        },
      });

      if (payload.newMedia?.length) {
        await tx.subServiceMedia.createMany({
          data: payload.newMedia.map((m: any) => ({
            subServiceId: dto.subServiceId,
            url: m.url,
            type: m.type,
            publicId: m.publicId,
          })),
        });
      }

      await tx.serviceChangeRequest.update({
        where: { id: changeRequest.id },
        data: {
          status: 'APPROVED',
          reviewedBy: adminId,
          reviewNote: dto.adminMessage,
        },
      });
    });

    return {
      message: 'Sub-service update approved successfully',
      data: {
        subServiceId: subService.id,
        subServiceName: subService.name,
        status: 'ACTIVE',
        adminMessage: dto.adminMessage ?? null,
      },
    };
  } else {
    await this.prisma.$transaction(async (tx) => {
      await tx.subService.update({
        where: { id: dto.subServiceId },
        data: { isAvailable: false, approvalStatus: 'REJECTED' },
      });

      await tx.serviceChangeRequest.update({
        where: { id: changeRequest.id },
        data: {
          status: 'REJECTED',
          reviewedBy: adminId,
          reviewNote: dto.adminMessage,
        },
      });
    });

    return {
      message: 'Sub-service update rejected',
      data: {
        subServiceId: subService.id,
        subServiceName: subService.name,
        status: 'REJECTED',
        adminMessage: dto.adminMessage ?? null,
      },
    };
  }
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🔹 Packages: list pending / detail / approve-reject
   * (docs/packages-implementation-plan.md §5.4)
   *
   * Package doesn't route through ServiceChangeRequest — it carries its own
   * `status` directly, so this is a small self-contained set of methods
   * rather than another branch of the generic change-request inbox above.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async listPendingPackages(query: { page?: number; limit?: number; status?: PackageStatus }) {
    // page/limit may arrive as NaN, not undefined — Nest's global
    // ValidationPipe({transform:true}) coerces an absent, bare
    // `@Query('page') page?: number` via `Number(undefined)` before this
    // function ever sees it, so a destructuring default here would never
    // fire (verified live — see docs/packages-implementation-plan.md
    // phase-6 test notes). `|| default` catches NaN where `= default` doesn't.
    const page = query.page || 1;
    const limit = query.limit || 10;
    const status = query.status;
    const skip = (page - 1) * limit;

    const where = { status: status ?? PackageStatus.PENDING_APPROVAL };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.package.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: { include: { user: { select: { fullName: true } } } },
          _count: { select: { exclusiveServices: true, attachedItems: true } },
        },
      }),
      this.prisma.package.count({ where }),
    ]);

    return {
      message: 'Packages retrieved successfully',
      data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    };
  }

  async getPackageForReview(packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        provider: { include: { user: { select: { fullName: true } } } },
        exclusiveServices: { include: { serviceType: true } },
        attachedItems: { include: { service: { include: { serviceType: true } } } },
      },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    const { exclusiveServices, attachedItems, ...rest } = pkg;
    const services = [
      ...exclusiveServices.map((s) => ({ ...s, membershipType: 'EXCLUSIVE' as const })),
      ...attachedItems.map((i) => ({ ...i.service, membershipType: 'ATTACHED' as const, isRequired: i.isRequired })),
    ];

    return { message: 'Package retrieved successfully', data: { ...rest, services } };
  }

  async approvePackage(adminId: string, dto: ApprovePackageDto) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: dto.packageId },
      include: { provider: { include: { user: true } } },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    if (pkg.status !== PackageStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Package cannot be reviewed while it is ${pkg.status} — only PENDING_APPROVAL packages can be approved or rejected`,
      );
    }

    const newStatus = dto.isApproved ? PackageStatus.ACTIVE : PackageStatus.REJECTED;

    const updated = await this.prisma.package.update({
      where: { id: dto.packageId },
      data: {
        status: newStatus,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote: dto.adminMessage,
      },
    });

    if (dto.isApproved) {
      this.domainEventBus.packageApproved({
        actorId: adminId,
        targetUserId: pkg.provider.userId,
        entityId: pkg.id,
        packageId: pkg.id,
        packageName: pkg.name,
        adminMessage: dto.adminMessage,
      });
    } else {
      this.domainEventBus.packageRejected({
        actorId: adminId,
        targetUserId: pkg.provider.userId,
        entityId: pkg.id,
        packageId: pkg.id,
        packageName: pkg.name,
        adminMessage: dto.adminMessage,
      });
    }

    return {
      message: dto.isApproved ? 'Package approved successfully' : 'Package rejected',
      data: {
        packageId: updated.id,
        packageName: updated.name,
        approvalStatus: updated.status,
        adminMessage: dto.adminMessage ?? null,
      },
    };
  }
}