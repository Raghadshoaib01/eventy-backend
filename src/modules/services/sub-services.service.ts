import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { CreateSubServiceDto } from './dto/create-sub-service.dto';
import {FileType} from '@prisma/client';
import { UpdateSubServiceDto } from './dto/update-sub-service.dto';

@Injectable()
export class SubServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
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
  // 2. التأكد أن الخدمة الرئيسية مفعلة
  // =====================================================

  if (
    subService.service.approvalStatus !==
    'ACTIVE'
  ) {
    throw new BadRequestException(
      'Cannot update sub-service before service approval',
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
  // 4. تحديث البيانات الأساسية
  // =====================================================

  await this.prisma.subService.update({
    where: {
      id: subServiceId,
    },

    data: {
      ...(dto.name !== undefined && {
        name: dto.name,
      }),

      ...(dto.description !== undefined && {
        description: dto.description,
      }),

      ...(dto.pricePerUnit !== undefined && {
        pricePerUnit: dto.pricePerUnit,
      }),

      ...(dto.unitType !== undefined && {
        unitType: dto.unitType,
      }),

      ...(dto.dailyCapacity !== undefined && {
        dailyCapacity: dto.dailyCapacity,
      }),


    },
  });

  // =====================================================
  // 5. رفع ملفات جديدة
  // =====================================================

  if (media?.length) {

    await Promise.all(
      media.map(async (file) => {

        // =========================================
        // TODO:
        // Cloudinary Upload
        // =========================================

        const uploadedFile = {
          secure_url: 'uploaded-url',
          public_id: 'public-id',
        };

        await this.prisma.subServiceMedia.create({
          data: {
            subServiceId: subService.id,

            url: uploadedFile.secure_url,

            publicId: uploadedFile.public_id,

            type: file.mimetype.startsWith(
              'video',
            )
              ? 'VIDEO'
              : 'IMAGE',
          },
        });
      }),
    );
  }

  // =====================================================
  // 6. جلب النسخة النهائية
  // =====================================================

  const finalSubService =
    await this.prisma.subService.findUnique({
      where: {
        id: subServiceId,
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

  // =====================================================
  // 7. Response
  // =====================================================

  return {
    success: true,

    message:
      'Sub-service updated successfully',

    data: finalSubService,
  };
}

async removeMedia(
  providerId: string,
  subServiceId: string,
  mediaId: string,
) {

  const media = await this.prisma.subServiceMedia.findFirst({
    where: {
      id: mediaId,
      subServiceId,
      subService: {
        service: {
          provider: {
            userId: providerId,
          },
        },
      },
    },
  });

  if (!media) {
    throw new NotFoundException(
      'Media not found',
    );
  }

  // حذف من cloudinary
  // await cloudinary.uploader.destroy(media.publicId);

  // حذف من قاعدة البيانات
  await this.prisma.subServiceMedia.delete({ 
    where: {
      id: mediaId,
    },
  });

  return {
    message: 'Media removed successfully',
  };
}


}
