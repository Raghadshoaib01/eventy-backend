import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { CreateSubServiceDto } from './dto/create-sub-service.dto';
import {FileType} from '@prisma/client';

@Injectable()
export class SubServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * إضافة SubService لخدمة موجودة
   * يُستخدم فقط لـ FOOD, PHOTOGRAPHY, FAVORS, DECORATION
   */
// src/modules/services/sub-services.service.ts

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


}
