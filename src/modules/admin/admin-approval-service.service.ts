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
} from './dto/ApproveProviderJoinDto';
import { ApprovalStatus } from 'src/shared/Enums/approval-status.enum';
import {
  DomainEvents,
  ProviderApprovedPayload,
  ProviderRejectedPayload,
  ServiceApprovedPayload,
  ServiceRejectedPayload,
} from 'src/common/events/domain-events';
import { DomainEventBus } from 'src/common/events/domain-event-bus';

@Injectable()
export class AdminApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly domainEventBus: DomainEventBus,   
  ) {}


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
   * 🔹 Function #2: Approve/Reject a New Service
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async approveService(adminId: string, dto: ApproveServiceDto) {


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
    // 3. Verify that the service is in PENDING_DETAILS or PENDING_APPROVAL status
    if (
      !['PENDING_DETAILS', 'PENDING_APPROVAL'].includes(service.approvalStatus || '')
    ) {
      throw new BadRequestException(
        `Service status is already ${service.approvalStatus}`,
      );
    }

    // 4. Execute approval or rejection
    if (dto.isApproved) {
      // ✅ Approval
      await this.prisma.$transaction(async (tx) => {
        // Update service status to ACTIVE
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'ACTIVE',
          },
        });

        // Note: SubService does not have an approvalStatus field in the schema.
        // isAvailable is used instead; rejected sub-services are deleted.

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
            isAvailable:true,
          },
          });
        }
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
          approvalStatus: 'ACTIVE',
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
   * 🔹 Function #3: Approve/Reject a New Sub-Service
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async approveSubService(adminId: string, dto: ApproveSubServiceDto) {


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

    // Note: SubService does not have an approvalStatus field in the schema.
    // A different approach is used: approval = mark available, rejection = delete.

    // 3. Execute approval or rejection
    if (dto.isApproved) {
      // ✅ Approval — update the sub-service to available
        // Update the approved sub-service
          await this.prisma.subService.update({
            where: {
              id:dto.subServiceId,
            },
            data: {
            isAvailable:true,
          },
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
      await this.prisma.subService.delete({
        where: { id: dto.subServiceId },
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
  // Approve/Reject a service update request
async approveServiceUpdate(adminId: string, dto: ApproveServiceDto) {
  const service = await this.prisma.service.findUnique({
    where: { id: dto.serviceId },
    include: {
      serviceType: true,
      provider: { include: { user: true } },
      subServices: true,
    },
  });

  if (!service) throw new NotFoundException('Service not found');

  if (service.approvalStatus !== 'PENDING_DETAILS') {
    throw new BadRequestException(
      `Service is not pending update review. Current status: ${service.approvalStatus}`,
    );
  }

  if (dto.isApproved) {
    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: dto.serviceId },
        data: { approvalStatus: 'ACTIVE' },
      });

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
          data: { isAvailable: true },
        });
      }
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
    await this.prisma.service.update({
      where: { id: dto.serviceId },
      data: { approvalStatus: 'REJECTED' },
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

// Approve/Reject a sub-service update request
async approveSubServiceUpdate(adminId: string, dto: ApproveSubServiceDto) {
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

  if (subService.service.approvalStatus !== 'ACTIVE') {
    throw new BadRequestException(
      'Parent service must be ACTIVE to review sub-service updates',
    );
  }

  if (dto.isApproved) {
    await this.prisma.subService.update({
      where: { id: dto.subServiceId },
      data: { isAvailable: true },
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
    await this.prisma.subService.update({
      where: { id: dto.subServiceId },
      data: { isAvailable: false },
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
}