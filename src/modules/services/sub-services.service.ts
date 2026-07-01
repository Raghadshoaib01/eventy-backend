import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { EngagementService } from 'src/shared/services/engagement.service';
import { CreateSubServiceDto } from './dto/create-sub-service.dto';
import {FileType} from '@prisma/client';
import { UpdateSubServiceDto } from './dto/update-sub-service.dto';

@Injectable()
export class SubServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly engagementService: EngagementService,
  ) {}



async createSubService(
  providerId: string,
  serviceId: string,
  dto: CreateSubServiceDto,
  media: Express.Multer.File[],
) {
  const provider = await this.prisma.serviceProvider.findFirst({
    where: {
      userId: providerId,
    },
  });

  if (!provider) {
    throw new NotFoundException('Provider not found for this user');
  }

  // 1. التحقق من ملكية الخدمة
  const service = await this.prisma.service.findFirst({
    where: {
      id: serviceId,
      providerId: provider.id,
    },
    include: {
      provider: true,
      serviceType: true,
    },
  });

  if (!service) {
    throw new NotFoundException(
      'Service not found or you do not own this service',
    );
  }

  // 2. التحقق من أن نوع الخدمة يسمح بـ SubServices
  const allowedTypes = ['FOOD', 'PHOTOGRAPHY', 'FAVORS', 'DECORATION'];
  if (!allowedTypes.includes(service.serviceType.name)) {
    throw new BadRequestException(
      `Sub-services are not allowed for ${service.serviceType.name}. Only FOOD, PHOTOGRAPHY, FAVORS, DECORATION support sub-services.`,
    );
  }

  // 3. التحقق من أن الخدمة مكتملة التفاصيل
  if (!service.isCompleted) {
    throw new BadRequestException(
      'Please complete service details first before adding sub-services',
    );
  }

  // 4. التحقق من وجود ملفات (على الأقل صورة واحدة مطلوبة)
  if (!media || media.length === 0) {
    throw new BadRequestException(
      'At least one image or video is required for sub-service',
    );
  }

  // 5. رفع الملفات
  const uploadedMedia = await Promise.all(
    media.map(async (file) => {
      const uploaded = await this.cloudinaryService.upload(file, {
        folder: 'eventy/services',
      });
      return {
        url: uploaded.url,  // ✅ url
        type: file.mimetype.startsWith('video') ? FileType.VIDEO : FileType.IMAGE,  // ✅ type
        publicId: uploaded.publicId,
      };
    }),
  );

  // 6. إنشاء SubService مع الملفات
  const subService = await this.prisma.subService.create({
    data: {
      name: dto.name,
      description: dto.description,
      pricePerUnit: dto.pricePerUnit,
      unitType: dto.unitType as any,
      dailyCapacity: dto.dailyCapacity,
      serviceId: serviceId,
      media: {
        create: uploadedMedia.map(m => ({
          url: m.url,  // ✅ url
          type: m.type,  // ✅ type
          publicId: m.publicId,
        })),
      },
    },
    include: {
      media: true,
    },
  });

  await this.prisma.serviceChangeRequest.create({
    data: {
      targetType: 'SUB_SERVICE',
      targetId: subService.id,
      requestType: 'CREATE',
      payload: dto as unknown as object,
      status: 'PENDING',
    },
  });

  return {
    message: 'Sub-service created successfully',
    data: subService,
  };
}

/**
 * الحصول على جميع SubServices لخدمة معينة
 */
async getSubServicesByService(serviceId: string) {
  const subServices = await this.prisma.subService.findMany({
    where: { serviceId },
    include: {
      media: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    message: 'Sub-services retrieved successfully',
    data: subServices,
  };
}

/**
 * الحصول على SubService واحدة بالتفاصيل
 */
async getSubServiceById(providerId: string, subServiceId: string) {
  const provider = await this.prisma.serviceProvider.findFirst({
    where: { userId: providerId },
  });

  if (!provider) {
    throw new NotFoundException('Provider not found for this user');
  }

  const subService = await this.prisma.subService.findFirst({
    where: {
      id: subServiceId,
      service: {
        providerId: provider.id,
      },
    },
    include: {
      media: true,
      service: {
        include: {
          serviceType: true,
        },
      },
    },
  });

  if (!subService) {
    throw new NotFoundException(
      'Sub-service not found or you do not own it',
    );
  }

  return {
    message: 'Sub-service retrieved successfully',
    data: subService,
  };
}

/**
 * حذف SubService
 */
async deleteSubService(providerId: string, subServiceId: string) {
  const provider = await this.prisma.serviceProvider.findFirst({
    where: { userId: providerId },
  });

  if (!provider) {
    throw new NotFoundException('Provider not found for this user');
  }

  // التحقق من الملكية
  const subService = await this.prisma.subService.findFirst({
    where: {
      id: subServiceId,
      service: {
        providerId: provider.id,
      },
    },
    include: {
      media: true,
    },
  });

  if (!subService) {
    throw new NotFoundException('Sub-service not found or you do not own it');
  }

  // حذف الملفات من Cloudinary
  for (const mediaItem of subService.media) {
    await this.cloudinaryService.delete(mediaItem.publicId);
  }

  // حذف SubService
  await this.prisma.subService.delete({
    where: { id: subServiceId },
  });

  return {
    message: 'Sub-service deleted successfully',
    data: null,
  };
}

async updateSubService(
  userId: string,
  serviceId: string,
  subServiceId: string,
  dto: UpdateSubServiceDto,
  media: Express.Multer.File[],
) {

  // =====================================================
  // 1. التحقق من ملكية الـ SubService
  // =====================================================

  const subService = await this.prisma.subService.findFirst({
    where: {
      id: subServiceId,
      serviceId: serviceId,

      service: {
        provider: {
          userId: userId,
        },
      },
    },

    include: {
      media: true,
      bookingItems: true,

      service: {
        include: {
          provider: true,
          serviceType: true,
        },
      },
    },
  });

  if (!subService) {
    throw new NotFoundException(
      'Sub-service not found',
    );
  }

  // =====================================================
  // 2. التأكد أن الخدمة الرئيسية والخدمة الفرعية مفعّلتين
  // =====================================================

  if (subService.service.approvalStatus !== 'ACTIVE') {
    throw new BadRequestException(
      'Cannot update sub-service before service approval',
    );
  }

  if (subService.approvalStatus !== 'ACTIVE') {
    throw new BadRequestException(
      `Sub-service cannot be edited while it is ${subService.approvalStatus}`,
    );
  }

  // =====================================================
  // 3. منع تعديل السعر بعد وجود حجوزات
  // =====================================================

  if (
    subService.bookingItems.length > 0 &&
    dto.pricePerUnit !== undefined
  ) {
    throw new BadRequestException(
      'Cannot change price after bookings exist',
    );
  }

  // =====================================================
  // 4. منع طلب تعديل أثناء وجود ارتباط فعّال (حجز مؤكد ضمن مناسبة حيّة)
  // =====================================================

  const engaged = await this.engagementService.hasActiveEngagement(
    'SUB_SERVICE',
    subServiceId,
  );
  if (engaged) {
    throw new BadRequestException(
      'Cannot request an update while the sub-service has an active engagement (confirmed/in-progress booking on a live event)',
    );
  }

  // =====================================================
  // 5. رفع ملفات جديدة يتم إرفاقها كجزء من الطلب فقط (لا تُطبّق مباشرة)
  // =====================================================

  const uploadedMedia = media?.length
    ? await Promise.all(
        media.map(async (file) => {
          const uploaded = await this.cloudinaryService.upload(file, {
            folder: 'eventy/sub-services',
          });
          return {
            url: uploaded.url,
            type: file.mimetype.startsWith('video') ? FileType.VIDEO : FileType.IMAGE,
            publicId: uploaded.publicId,
          };
        }),
      )
    : [];

  const payload = { ...dto, newMedia: uploadedMedia };

  // =====================================================
  // 6. إنشاء طلب تعديل + تجميد الخدمة الفرعية لحين المراجعة
  // =====================================================

  const changeRequest = await this.prisma.$transaction(async (tx) => {
    const cr = await tx.serviceChangeRequest.create({
      data: {
        targetType: 'SUB_SERVICE',
        targetId: subServiceId,
        requestType: 'UPDATE',
        payload: payload as unknown as object,
        status: 'PENDING',
      },
    });

    await tx.subService.update({
      where: { id: subServiceId },
      data: { approvalStatus: 'PENDING_APPROVAL' },
    });

    return cr;
  });

  return {
    message: 'Update request submitted for admin review',
    data: {
      subServiceId,
      changeRequestId: changeRequest.id,
      approvalStatus: 'PENDING_APPROVAL',
    },
  };
}

// تحديث ميديا الخدمة الفرعية (إضافة أو حذف) مع ضمان وجود ملف واحد على الأقل
async updateSubServiceMedia(
  providerId: string,
  subServiceId: string,
  deleteMediaIds: string[],   // معرفات الملفات المراد حذفها
  newMedia: Express.Multer.File[],
) {
  // 1. التحقق من الملكية
  const subService = await this.prisma.subService.findFirst({
    where: {
      id: subServiceId,
      service: {
        provider: { userId: providerId },
      },
    },
    include: { media: true },
  });

  if (!subService) {
    throw new NotFoundException('Sub-service not found or you do not own it');
  }

  const currentCount = subService.media.length;
  const deleteCount = deleteMediaIds?.length ?? 0;
  const addCount = newMedia?.length ?? 0;

  // 2. ضمان بقاء ملف واحد على الأقل
  if (currentCount - deleteCount + addCount < 1) {
    throw new BadRequestException(
      'Sub-service must have at least one media file. Add new media before deleting all existing ones.',
    );
  }

  // 3. التحقق أن الملفات المراد حذفها تنتمي لهذه الخدمة الفرعية
  if (deleteMediaIds?.length) {
    const toDelete = subService.media.filter((m) =>
      deleteMediaIds.includes(m.id),
    );

    if (toDelete.length !== deleteMediaIds.length) {
      throw new BadRequestException(
        'One or more media IDs do not belong to this sub-service',
      );
    }

    // حذف من Cloudinary ثم من DB
    await Promise.all(
      toDelete.map(async (m) => {
        if (m.publicId) {
          await this.cloudinaryService.delete(m.publicId);
        }
        await this.prisma.subServiceMedia.delete({ where: { id: m.id } });
      }),
    );
  }

  // 4. رفع الملفات الجديدة
  if (newMedia?.length) {
    const uploadedMedia = await Promise.all(
      newMedia.map(async (file) => {
        const uploaded = await this.cloudinaryService.upload(file, {
          folder: 'eventy/sub-services',
        });
        return {
          url: uploaded.url,
          type: file.mimetype.startsWith('video') ? FileType.VIDEO : FileType.IMAGE,
          publicId: uploaded.publicId,
        };
      }),
    );

    await this.prisma.subServiceMedia.createMany({
      data: uploadedMedia.map((m) => ({
        subServiceId,
        url: m.url,
        type: m.type,
        publicId: m.publicId,
      })),
    });
  }

  // 5. إرجاع النسخة المحدّثة
  const updated = await this.prisma.subService.findUnique({
    where: { id: subServiceId },
    include: { media: true },
  });

  return {
    message: 'Sub-service media updated successfully',
    data: updated,
  };
}

}
