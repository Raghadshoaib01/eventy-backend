import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AdminApprovalService } from './admin-approval-service.service';
import {
  ApproveProviderJoinDto,
  ApproveServiceDto,
  ApproveSubServiceDto,
  ApprovePackageDto,
} from './dto/ApproveProviderJoinDto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuditAction, PackageStatus, UserRole } from '@prisma/client';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TrackAction } from 'src/common/decorators/track-action.decorator';
import { DomainEvents } from 'src/common/events/domain-events';
import { ChangeRequestQueryDto } from './dto/change-request-query.dto';
import { Audit } from 'src/common/decorators/audit.decorator';

@ApiTags('Admin - Approvals')
@Controller('admin/approvals')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminApprovalController {
  constructor(
    private readonly adminApprovalService: AdminApprovalService,
  ) {}

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 Requests Inbox: list / detail
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Get()
  @ApiOperation({
    summary: 'List change requests inbox',
    description:
      'Covers all 4 cases: new service, service update, new sub-service, sub-service update. ' +
      'Defaults to PENDING status when no status filter is given.',
  })
  @ApiResponse({ status: 200, description: 'Change requests retrieved successfully' })
  listChangeRequests(@Query() query: ChangeRequestQueryDto) {
    return this.adminApprovalService.listChangeRequests(query);
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 Packages inbox (docs/packages-implementation-plan.md §5.4)
   *
   * MUST be registered before the generic `:id` route below — Nest/Express
   * match routes in declaration order, and `:id` would otherwise swallow
   * `/admin/approvals/packages` as if "packages" were an id (verified live:
   * it did, returning "Change request not found" for every packages route).
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Get('packages')
  @ApiOperation({
    summary: 'List packages awaiting review',
    description: 'Defaults to PENDING_APPROVAL when no status filter is given.',
  })
  @ApiResponse({ status: 200, description: 'Packages retrieved successfully' })
  listPendingPackages(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: PackageStatus,
  ) {
    return this.adminApprovalService.listPendingPackages({ page, limit, status });
  }

  @Get('packages/:id')
  @ApiOperation({ summary: 'Get package details for review' })
  @ApiResponse({ status: 200, description: 'Package retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  getPackageForReview(@Param('id') id: string) {
    return this.adminApprovalService.getPackageForReview(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get change request details by ID' })
  @ApiResponse({ status: 200, description: 'Change request retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Change request not found' })
  getChangeRequestById(@Param('id') id: string) {
    return this.adminApprovalService.getChangeRequestById(id);
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 API #1: Approve/Reject a Service Provider Join Request
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Post('provider-join')
  @TrackAction({
  action: AuditAction.APPROVE,
  entity: 'ServiceProvider',
  audit: true,                               // ✅ Save Audit log
  notify: DomainEvents.PROVIDER_APPROVED,    // ✅ Emit domain event
  entityIdPath: 'providerId'
})
  @Audit({
    action: (data: any) =>
      data?.data?.approvalStatus === 'REJECTED' ? AuditAction.REJECT : AuditAction.APPROVE,
    entity: 'ServiceProvider',
    entityIdKey: 'providerId',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve or reject a new service provider join request',
    description: `
      The admin approves or rejects a new service provider join request.

      On approval:
      - Provider status is updated to APPROVED
      - Service status is updated to PENDING_DETAILS
      - A welcome message is sent requesting the provider to complete their details

      On rejection:
      - Provider and service statuses are updated to REJECTED
      - A rejection message is sent with the reason (if provided)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Request processed successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Provider approved successfully',
        data: {
          providerId: 'uuid-123',
          providerName: 'Al-Noor Catering',
          serviceId: 'uuid-456',
          serviceName: 'FOOD',
          approvalStatus: 'APPROVED',
          nextStep: 'Provider should complete service details',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'User is not an admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Service provider or service not found',
  })
  async approveProviderJoin(
    @Request() req,
    @Body() dto: ApproveProviderJoinDto,
  ) {
    const adminId = req.user.sub;
    return this.adminApprovalService.approveProviderJoin(adminId, dto);
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 API #2: Approve/Reject a New Service
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Post('service')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: (data: any) =>
      data?.data?.approvalStatus === 'REJECTED' ? AuditAction.REJECT : AuditAction.APPROVE,
    entity: 'Service',
    entityIdKey: 'serviceId',
  })
  @ApiOperation({
    summary: 'Approve or reject a new service',
    description: `
      The admin approves or rejects a new service.

      On approval:
      - Service status is updated to ACTIVE
      - Specified sub-services are individually approved or rejected
      - A welcome message is sent for the approved service

      On rejection:
      - Service status and all sub-services are updated to REJECTED
      - A rejection message is sent with the reason (if provided)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Request processed successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Service approved successfully',
        data: {
          serviceId: 'uuid-789',
          serviceName: 'PHOTOGRAPHY',
          approvalStatus: 'ACTIVE',
          approvedSubServices: 3,
          rejectedSubServices: 1,
          adminMessage: null,
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'User is not an admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Service not found',
  })
  async approveService(@Request() req, @Body() dto: ApproveServiceDto) {
    const adminId = req.user.sub;
    return this.adminApprovalService.approveService(adminId, dto);
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 API #3: Approve/Reject a New Sub-Service
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Post('sub-service')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: (data: any) =>
      data?.data?.status === 'REJECTED' ? AuditAction.REJECT : AuditAction.APPROVE,
    entity: 'SubService',
    entityIdKey: 'subServiceId',
  })
  @ApiOperation({
    summary: 'Approve or reject a new sub-service',
    description: `
      The admin approves or rejects a new sub-service.

      On approval:
      - Sub-service status is updated to ACTIVE
      - A welcome message is sent to the provider

      On rejection:
      - Sub-service status is updated to REJECTED
      - A rejection message is sent with the reason (if provided)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Request processed successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Sub-service approved successfully',
        data: {
          subServiceId: 'uuid-321',
          subServiceName: 'Full Event Package',
          approvalStatus: 'ACTIVE',
          adminMessage: null,
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'User is not an admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Sub-service not found',
  })
  async approveSubService(@Request() req, @Body() dto: ApproveSubServiceDto) {
    const adminId = req.user.sub;
    return this.adminApprovalService.approveSubService(adminId, dto);
  }

  /**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🔹 API #4: Approve/Reject Service Update Request
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Post('service-update')
@HttpCode(HttpStatus.OK)
@Audit({
  action: (data: any) =>
    data?.data?.approvalStatus === 'REJECTED' ? AuditAction.REJECT : AuditAction.APPROVE,
  entity: 'Service',
  entityIdKey: 'serviceId',
})
@ApiOperation({
  summary: 'Approve or reject a service update request',
  description: `
    Admin reviews a provider's request to update an existing service.
    
    On approval:
    - Service status is set back to ACTIVE
    - Approved sub-services are marked as available
    - Rejected sub-services are deleted
    
    On rejection:
    - Service status is set to REJECTED
    - Provider is notified with the rejection reason
  `,
})
@ApiResponse({
  status: 200,
  description: 'Request processed successfully',
  schema: {
    example: {
      success: true,
      statusCode: 200,
      message: 'Service update approved successfully',
      data: {
        serviceId: 'uuid-789',
        serviceName: 'PHOTOGRAPHY',
        approvalStatus: 'ACTIVE',
        approvedSubServices: 2,
        rejectedSubServices: 1,
        adminMessage: null,
      },
    },
  },
})
@ApiResponse({
  status: 400,
  description: 'Service is not pending an update review',
})
@ApiResponse({
  status: 403,
  description: 'User is not an admin',
})
@ApiResponse({
  status: 404,
  description: 'Service not found',
})
async approveServiceUpdate(@Request() req, @Body() dto: ApproveServiceDto) {
  const adminId = req.user.sub;
  return this.adminApprovalService.approveServiceUpdate(adminId, dto);
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🔹 API #5: Approve/Reject Sub-Service Update Request
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Post('sub-service-update')
@HttpCode(HttpStatus.OK)
@Audit({
  action: (data: any) =>
    data?.data?.status === 'REJECTED' ? AuditAction.REJECT : AuditAction.APPROVE,
  entity: 'SubService',
  entityIdKey: 'subServiceId',
})
@ApiOperation({
  summary: 'Approve or reject a sub-service update request',
  description: `
    Admin reviews a provider's request to update an existing sub-service.

    On approval:
    - Sub-service is marked as available (isAvailable = true)
    - Provider is notified that the update went live

    On rejection:
    - Sub-service is marked as unavailable (isAvailable = false)
    - Provider is notified with the rejection reason
  `,
})
@ApiResponse({
  status: 200,
  description: 'Request processed successfully',
  schema: {
    example: {
      success: true,
      statusCode: 200,
      message: 'Sub-service update approved successfully',
      data: {
        subServiceId: 'uuid-321',
        subServiceName: 'Buffet Setup',
        status: 'ACTIVE',
        adminMessage: null,
      },
    },
  },
})
@ApiResponse({
  status: 400,
  description: 'Parent service must be ACTIVE to review sub-service updates',
})
@ApiResponse({
  status: 403,
  description: 'User is not an admin',
})
@ApiResponse({
  status: 404,
  description: 'Sub-service not found',
})
async approveSubServiceUpdate(
  @Request() req,
  @Body() dto: ApproveSubServiceDto,
) {
  const adminId = req.user.sub;
  return this.adminApprovalService.approveSubServiceUpdate(adminId, dto);
}

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 API #6: Approve/Reject a submitted Package
   * (docs/packages-implementation-plan.md §5.4) — list/detail routes moved
   * above the generic `:id` route near the top of this controller.
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Post('package')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: (data: any) =>
      data?.data?.approvalStatus === 'REJECTED' ? AuditAction.REJECT : AuditAction.APPROVE,
    entity: 'Package',
    entityIdKey: 'packageId',
  })
  @ApiOperation({
    summary: 'Approve or reject a submitted package',
    description: `
      The admin approves or rejects a package submitted via POST /provider/packages/:id/submit.

      On approval: Package status is updated to ACTIVE and becomes visible to customers.
      On rejection: Package status is updated to REJECTED with an optional reason; the
      provider may edit and resubmit it.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Request processed successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Package approved successfully',
        data: {
          packageId: 'uuid-123',
          packageName: 'Grand Wedding Bundle',
          approvalStatus: 'ACTIVE',
          adminMessage: null,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Package is not pending approval' })
  @ApiResponse({ status: 403, description: 'User is not an admin' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async approvePackage(@Request() req, @Body() dto: ApprovePackageDto) {
    const adminId = req.user.sub;
    return this.adminApprovalService.approvePackage(adminId, dto);
  }
}
