import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  ApproveProviderJoinDto,
  ApproveServiceDto,
  ApproveSubServiceDto,
} from './dto/ApproveProviderJoinDto';
import { ApprovalStatus } from 'src/shared/Enums/approval-status.enum';

@Injectable()
export class AdminApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔹 الدالة الأولى: قبول/رفض طلب انضمام مزود خدمة
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async approveProviderJoin(adminId: string, dto: ApproveProviderJoinDto) {

    // 2. جلب مزود الخدمة والخدمة
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

    // 3. التحقق من أن الطلب في حالة PENDING
    if (provider.approvalStatus !== 'PENDING') {
      throw new BadRequestException(
        `Provider status is already ${provider.approvalStatus}`,
      );
    }

    // 4. تنفيذ القبول أو الرفض
    if (dto.isApproved) {
      // ✅ القبول
      await this.prisma.$transaction(async (tx) => {
        // تحديث حالة المزود إلى APPROVED
        await tx.serviceProvider.update({
          where: { id: dto.providerId },
          data: {
            approvalStatus: ApprovalStatus.APPROVED,
          },
        });

        // تحديث حالة الخدمة إلى PENDING_DETAILS
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'PENDING_DETAILS',
          },
        });

        // تحديث حالة المستخدم إلى ACTIVE
        await tx.user.update({
          where: { id: provider.userId },
          data: {
            status: 'ACTIVE',
          },
        });
      });

      // TODO: إرسال بريد إلكتروني للترحيب
      console.log(`
        📧 إرسال بريد ترحيب إلى: ${provider.user.email}
        
        مرحباً ${provider.user.fullName}،
        
        تم قبول طلب انضمامك كمزود خدمة في منصة Eventy! 🎉
        
        معلومات الحساب:
        - اسم العمل: ${provider.businessName}
        - نوع الخدمة: ${service.serviceType.name}
        - حالة الحساب: مقبول ✅
        
        الخطوة التالية:
        يرجى إكمال تفاصيل الخدمة من خلال لوحة التحكم الخاصة بك.
        
        ${dto.adminMessage ? `ملاحظة من الإدارة: ${dto.adminMessage}` : ''}
        
        مع تحيات فريق Eventy
      `);

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
      // ❌ الرفض
      await this.prisma.$transaction(async (tx) => {
        // تحديث حالة المزود إلى REJECTED
        await tx.serviceProvider.update({
          where: { id: dto.providerId },
          data: {
            approvalStatus: ApprovalStatus.REJECTED,
          },
        });

        // تحديث حالة الخدمة إلى REJECTED
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'REJECTED',
          },
        });

        // تحديث حالة المستخدم إلى SUSPENDED
        await tx.user.update({
          where: { id: provider.userId },
          data: {
            status: 'SUSPENDED',
          },
        });
      });

      // TODO: إرسال بريد إلكتروني بالاعتذار
      console.log(`
        📧 إرسال بريد اعتذار إلى: ${provider.user.email}
        
        عزيزي ${provider.user.fullName},
        
        نأسف لإبلاغك بأنه تم رفض طلب انضمامك كمزود خدمة في منصة Eventy.
        
        معلومات الطلب:
        - اسم العمل: ${provider.businessName}
        - نوع الخدمة: ${service.serviceType.name}
        
        ${dto.adminMessage ? `سبب الرفض: ${dto.adminMessage}` : ''}
        
        يمكنك إعادة التقديم بعد تحسين المعلومات المطلوبة.
        
        مع تحيات فريق Eventy
      `);

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
   * 🔹 الدالة الثانية: قبول/رفض خدمة جديدة
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async approveService(adminId: string, dto: ApproveServiceDto) {


    // 2. جلب الخدمة مع الخدمات الفرعية
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
    // 3. التحقق من أن الخدمة في حالة PENDING_DETAILS أو PENDING
    if (
      !['PENDING_DETAILS', 'PENDING_APPROVAL'].includes(service.approvalStatus || '')
    ) {
      throw new BadRequestException(
        `Service status is already ${service.approvalStatus}`,
      );
    }

    // 4. تنفيذ القبول أو الرفض
    if (dto.isApproved) {
      // ✅ القبول
      await this.prisma.$transaction(async (tx) => {
        // تحديث حالة الخدمة إلى ACTIVE
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'ACTIVE',
          },
        });

        // ملاحظة: SubService لا يحتوي على approvalStatus في schema
        // لذلك نستخدم isActive بدلاً منه أو نحذف SubServices المرفوضة
        
        // حذف الخدمات الفرعية المرفوضة
        if (dto.rejectedSubServiceIds && dto.rejectedSubServiceIds.length > 0) {
          await tx.subService.deleteMany({
            where: {
              id: { in: dto.rejectedSubServiceIds },
              serviceId: dto.serviceId,
            },
          });
        }
        // تحديث الخدمات الفرعية المقبولة 
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
              // حذف الخدمات الفرعية المرفوضة

      // إحصائيات الخدمات الفرعية
      const approvedCount = dto.approvedSubServiceIds?.length || 0;
      const rejectedCount = dto.rejectedSubServiceIds?.length || 0;

      // TODO: إرسال بريد إلكتروني
      console.log(`
        📧 إرسال بريد ترحيب إلى: ${service.provider.user.email}
        
        مرحباً ${service.provider.user.fullName},
        
        تم قبول خدمتك الجديدة في منصة Eventy! 🎉
        
        معلومات الخدمة:
        - نوع الخدمة: ${service.serviceType.name}
        - الخدمات الفرعية المتاحة: ${approvedCount}
        ${rejectedCount > 0 ? `- الخدمات الفرعية المحذوفة: ${rejectedCount}` : ''}
        
        ${dto.adminMessage ? `ملاحظة من الإدارة: ${dto.adminMessage}` : ''}
        
        يمكنك الآن البدء باستقبال الحجوزات!
        
        مع تحيات فريق Eventy
      `);

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
      // ❌ الرفض
      await this.prisma.$transaction(async (tx) => {
        // تحديث حالة الخدمة إلى REJECTED
        await tx.service.update({
          where: { id: dto.serviceId },
          data: {
            approvalStatus: 'REJECTED',
          },
        });

        // حذف جميع الخدمات الفرعية
        await tx.subService.deleteMany({
          where: {
            serviceId: dto.serviceId,
          },
        });
      });

      // TODO: إرسال بريد إلكتروني بالاعتذار
      console.log(`
        📧 إرسال بريد اعتذار إلى: ${service.provider.user.email}
        
        عزيزي ${service.provider.user.fullName},
        
        نأسف لإبلاغك بأنه تم رفض خدمتك الجديدة.
        
        معلومات الخدمة:
        - نوع الخدمة: ${service.serviceType.name}
        
        ${dto.adminMessage ? `سبب الرفض: ${dto.adminMessage}` : ''}
        
        يمكنك تعديل المعلومات وإعادة التقديم.
        
        مع تحيات فريق Eventy
      `);

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
   * 🔹 الدالة الثالثة: قبول/رفض خدمة فرعية جديدة
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async approveSubService(adminId: string, dto: ApproveSubServiceDto) {
 

    // 2. جلب الخدمة الفرعية
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

    // ملاحظة: SubService لا يحتوي على approvalStatus في schema
    // لذلك سنستخدم منطق مختلف: القبول = لا شيء، الرفض = حذف
    
    // 3. تنفيذ القبول أو الرفض
    if (dto.isApproved) {
      // ✅ القبول - لا حاجة لتحديث لأن SubService مقبولة افتراضياً
        // تحديث الخدمات الفرعية المقبولة 
          await this.prisma.subService.update({
            where: {
              id:dto.subServiceId,
            },
            data: {
            isAvailable:true,
          },
          });
        
      // TODO: إرسال بريد إلكتروني
      console.log(`
        📧 إرسال بريد ترحيب إلى: ${subService.service.provider.user.email}
        
        مرحباً ${subService.service.provider.user.fullName},
        
        تم قبول الخدمة الفرعية الجديدة! 🎉
        
        معلومات الخدمة:
        - الاسم: ${subService.name}
        - السعر: ${subService.pricePerUnit} / ${subService.unitType}
        - الخدمة الرئيسية: ${subService.service.serviceType.name}
        
        ${dto.adminMessage ? `ملاحظة من الإدارة: ${dto.adminMessage}` : ''}
        
        مع تحيات فريق Eventy
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
      // ❌ الرفض - حذف الخدمة الفرعية
      await this.prisma.subService.delete({
        where: { id: dto.subServiceId },
      });

      // TODO: إرسال بريد إلكتروني بالاعتذار
      console.log(`
        📧 إرسال بريد اعتذار إلى: ${subService.service.provider.user.email}
        
        عزيزي ${subService.service.provider.user.fullName},
        
        نأسف لإبلاغك بأنه تم رفض الخدمة الفرعية.
        
        معلومات الخدمة:
        - الاسم: ${subService.name}
        - الخدمة الرئيسية: ${subService.service.serviceType.name}
        
        ${dto.adminMessage ? `سبب الرفض: ${dto.adminMessage}` : ''}
        
        يمكنك تعديل المعلومات وإعادة التقديم.
        
        مع تحيات فريق Eventy
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
}