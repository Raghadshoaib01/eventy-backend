// src/modules/services/service details.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import {
  CompleteServiceDetailsDto,
  CompleteHallSoundDetailsDto,
} from '../services/dto/Complete service details.dto';
import { FileType } from '@prisma/client';

@Injectable()
export class ServiceDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async completeServiceDetails(
    providerId: string,
    serviceId: string,
    dto: CompleteServiceDetailsDto,
    media?: Express.Multer.File[],
  ) {
    const provider = await this.prisma.serviceProvider.findFirst({
      where: { userId: providerId },
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

    // 2. التحقق من أن Provider مقبول
    if (service.provider.approvalStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Your account must be approved before completing service details',
      );
    }

    // 3. التحقق من نوع الخدمة
    const allowedTypes = ['FOOD', 'PHOTOGRAPHY', 'FAVORS', 'DECORATION'];
    if (!allowedTypes.includes(service.serviceType.name)) {
      throw new BadRequestException(
        `This endpoint is only for ${allowedTypes.join(', ')}. Use completeHallSoundDetails for HALL/SOUND.`,
      );
    }

    // ✅ 4. التحقق من وجود ملفات
    if (!media || media.length === 0) {
      throw new BadRequestException('At least one media file is required');
    }

    // ✅ 5. التحقق من أن كل SubService لديه mediaIndex صحيح
    const maxIndex = media.length - 1;
    for (const subService of dto.subServices) {
      if (subService.mediaIndex < 0 || subService.mediaIndex > maxIndex) {
        throw new BadRequestException(
          `Invalid mediaIndex ${subService.mediaIndex} for sub-service "${subService.name}". Must be between 0 and ${maxIndex}`,
        );
      }
    }

    // ✅ 6. التحقق من أن كل ملف مستخدم مرة واحدة على الأقل
    const usedIndices = new Set(dto.subServices.map(s => s.mediaIndex));
    if (usedIndices.size < dto.subServices.length) {
      throw new BadRequestException(
        'Each sub-service must have a unique media file. Duplicate mediaIndex found.',
      );
    }

    // 7. رفع الملفات
    const uploadedMedia = await Promise.all(
      media.map(async (file) => {
        const uploaded = await this.cloudinaryService.upload(file, {
          folder: 'eventy/services',
        });
        return {
          url: uploaded.url,
          type: file.mimetype.startsWith('video')
            ? FileType.VIDEO
            : FileType.IMAGE,
          publicId: uploaded.publicId,
        };
      }),
    );

    // 8. تحديث الخدمة + إضافة SubServices + BankAccount في Transaction
    const updatedService = await this.prisma.$transaction(async (tx) => {
      // Update Service
      const service = await tx.service.update({
        where: { id: serviceId },
        data: {
          minCapacity: dto.minCapacity,
          maxCapacity: dto.maxCapacity,
          isCompleted: true,

          // Availability
          availability: {
            create: dto.availability.map((avail) => ({
              workFromTime: avail.workFromTime,
              workToTime: avail.workToTime,
              capacity: avail.capacity,
              hasSlots: avail.hasSlots ?? false,

              workingDays: {
                create: {
                  dayOfWeek: avail.dayOfWeek,
                },
              },

              timeSlots: avail.timeSlots?.length
                ? {
                    create: avail.timeSlots.map((slot) => ({
                      fromTime: slot.startTime,
                      toTime: slot.endTime,
                      capacity: slot.capacity,
                    })),
                  }
                : undefined,
            })),
          },

          // ✅ SubServices - كل واحدة مع الميديا الخاصة بها
          subServices: {
            create: dto.subServices.map((sub) => {
              const mediaFile = uploadedMedia[sub.mediaIndex];
              return {
                name: sub.name,
                description: sub.description,
                pricePerUnit: sub.pricePerUnit,
                unitType: sub.unitType,
                dailyCapacity: sub.dailyCapacity,

                media: {
                  create: {
                    url: mediaFile.url,
                    type: mediaFile.type,
                    publicId: mediaFile.publicId,
                  },
                },
              };
            }),
          },
        },
        include: {
          files: true,
          availability: {
            include: {
              timeSlots: true,
              workingDays: true,
            },
          },
          subServices: {
            include: {
              media: true,
            },
          },
        },
      });

      // Create/Update Bank Account
      await tx.bankAccount.upsert({
        where: { userId: providerId },
        update: {
          iban: dto.bankAccount.iban,
          bankName: dto.bankAccount.bankName,
          accountHolderName: dto.bankAccount.accountHolderName,
          isVerified: false,
        },
        create: {
          userId: providerId,
          iban: dto.bankAccount.iban,
          bankName: dto.bankAccount.bankName,
          accountHolderName: dto.bankAccount.accountHolderName,
          isVerified: false,
        },
      });

      return service;
    });

    return {
      message: 'Service details completed successfully with sub-services.',
      data: updatedService,
    };
  }

  async completeHallSoundDetails(
    providerId: string,
    serviceId: string,
    dto: CompleteHallSoundDetailsDto,
    media: Express.Multer.File[],
  ) {
    const provider = await this.prisma.serviceProvider.findFirst({
      where: { userId: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found for this user');
    }

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

    if (service.provider.approvalStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Your account must be approved before completing service details',
      );
    }

    if (!['HALL', 'SOUND'].includes(service.serviceType.name)) {
      throw new BadRequestException(
        'This endpoint is only for HALL or SOUND services.',
      );
    }

    // ✅ التحقق من وجود ملفات
    if (!media || media.length === 0) {
      throw new BadRequestException(
        'At least one media file is required for Hall/Sound service',
      );
    }

    const uploadedMedia = await Promise.all(
      media.map(async (file) => {
        const uploaded = await this.cloudinaryService.upload(file, {
          folder: 'eventy/halls',
        });
        return {
          url: uploaded.url,
          type: file.mimetype.startsWith('video')
            ? FileType.VIDEO
            : FileType.IMAGE,
          publicId: uploaded.publicId,
        };
      }),
    );

    const updatedService = await this.prisma.$transaction(async (tx) => {
      const service = await tx.service.update({
        where: { id: serviceId },
        data: {
          minCapacity: dto.minCapacity,
          maxCapacity: dto.maxCapacity,
          price: dto.price,
          isCompleted: true,

          files: {
            create: uploadedMedia.map(m => ({
              fileUrl: m.url,
              fileType: m.type,
            })),
          },

          availability: {
            create: dto.availability.map((avail) => ({
              workFromTime: avail.workFromTime,
              workToTime: avail.workToTime,
              capacity: avail.capacity,
              hasSlots: avail.hasSlots ?? false,

              workingDays: {
                create: {
                  dayOfWeek: avail.dayOfWeek,
                },
              },

              timeSlots: avail.timeSlots?.length
                ? {
                    create: avail.timeSlots.map((slot) => ({
                      fromTime: slot.startTime,
                      toTime: slot.endTime,
                      capacity: slot.capacity,
                    })),
                  }
                : undefined,
            })),
          },
        },
        include: {
          files: true,
          availability: {
            include: {
              timeSlots: true,
              workingDays: true,
            },
          },
        },
      });

      // Create/Update Bank Account
      await tx.bankAccount.upsert({
        where: { userId: providerId },
        update: {
          iban: dto.bankAccount.iban,
          bankName: dto.bankAccount.bankName,
          accountHolderName: dto.bankAccount.accountHolderName,
          isVerified: false,
        },
        create: {
          userId: providerId,
          iban: dto.bankAccount.iban,
          bankName: dto.bankAccount.bankName,
          accountHolderName: dto.bankAccount.accountHolderName,
          isVerified: false,
        },
      });

      return service;
    });

    return {
      message: 'Hall/Sound service completed successfully',
      data: updatedService,
    };
  }
}