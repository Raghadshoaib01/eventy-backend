import {
  Controller,
  Post,
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
} from './dto/ApproveProviderJoinDto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RolesGuard } from 'src/common/guards/roles.guard';

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
   * 🔹 API #1: قبول/رفض طلب انضمام مزود خدمة
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Post('provider-join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'قبول أو رفض طلب انضمام مزود خدمة جديد',
    description: `
      يقوم السوبر أدمن بقبول أو رفض طلب انضمام مزود خدمة جديد.
      
      في حالة القبول:
      - تحديث حالة المزود إلى APPROVED
      - تحديث حالة الخدمة إلى PENDING_DETAILS
      - إرسال رسالة ترحيب مع طلب إكمال البيانات
      
      في حالة الرفض:
      - تحديث حالة المزود والخدمة إلى REJECTED
      - إرسال رسالة اعتذار مع السبب (إن وُجد)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'تم معالجة الطلب بنجاح',
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
    description: 'المستخدم ليس سوبر أدمن',
  })
  @ApiResponse({
    status: 404,
    description: 'مزود الخدمة أو الخدمة غير موجودة',
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
   * 🔹 API #2: قبول/رفض خدمة جديدة
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Post('service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'قبول أو رفض خدمة جديدة',
    description: `
      يقوم السوبر أدمن بقبول أو رفض خدمة جديدة.
      
      في حالة القبول:
      - تحديث حالة الخدمة إلى ACTIVE
      - قبول أو رفض الخدمات الفرعية المحددة
      - إرسال رسالة ترحيب بالخدمة المقبولة
      
      في حالة الرفض:
      - تحديث حالة الخدمة وجميع الخدمات الفرعية إلى REJECTED
      - إرسال رسالة اعتذار مع السبب (إن وُجد)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'تم معالجة الطلب بنجاح',
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
    description: 'المستخدم ليس سوبر أدمن',
  })
  @ApiResponse({
    status: 404,
    description: 'الخدمة غير موجودة',
  })
  async approveService(@Request() req, @Body() dto: ApproveServiceDto) {
    const adminId = req.user.sub;
    return this.adminApprovalService.approveService(adminId, dto);
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 API #3: قبول/رفض خدمة فرعية جديدة
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  @Post('sub-service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'قبول أو رفض خدمة فرعية جديدة',
    description: `
      يقوم السوبر أدمن بقبول أو رفض خدمة فرعية جديدة.
      
      في حالة القبول:
      - تحديث حالة الخدمة الفرعية إلى ACTIVE
      - إرسال رسالة ترحيب
      
      في حالة الرفض:
      - تحديث حالة الخدمة الفرعية إلى REJECTED
      - إرسال رسالة اعتذار مع السبب (إن وُجد)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'تم معالجة الطلب بنجاح',
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
    description: 'المستخدم ليس سوبر أدمن',
  })
  @ApiResponse({
    status: 404,
    description: 'الخدمة الفرعية غير موجودة',
  })
  async approveSubService(@Request() req, @Body() dto: ApproveSubServiceDto) {
    const adminId = req.user.sub;
    return this.adminApprovalService.approveSubService(adminId, dto);
  }
}
