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
  files: {
    serviceMedia?: Express.Multer.File[];
    subServiceMedia?: Express.Multer.File[];
  },
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

  // 2. التحقق من موافقة الحساب
  if (service.provider.approvalStatus !== 'APPROVED') {
    throw new BadRequestException(
      'Your account must be approved before completing service details',
    );
  }

  // 3. التحقق من نوع الخدمة
  const allowedTypes = ['FOOD', 'PHOTOGRAPHY', 'FAVORS', 'DECORATION'];

  if (!allowedTypes.includes(service.serviceType.name)) {
    throw new BadRequestException(
      `This endpoint is only for ${allowedTypes.join(', ')}`,
    );
  }

  // 4. التحقق من صورة الخدمة الرئيسية
  if (!files.serviceMedia?.length) {
    throw new BadRequestException('Service image is required');
  }

  // 5. التحقق من صور SubService
  if (!files.subServiceMedia?.length) {
    throw new BadRequestException('SubService media is required');
  }

  // 6. رفع صورة الخدمة الرئيسية
  const serviceImage = await this.cloudinaryService.upload(
    files.serviceMedia[0],
    {
      folder: 'eventy/services',
    },
  );

  // 7. رفع صور SubService
  const subServiceMediaUploads = await Promise.all(
    files.subServiceMedia.map((file) =>
      this.cloudinaryService.upload(file, {
        folder: 'eventy/sub-services',
      }),
    ),
  );

  // 8. Transaction
  const updatedService = await this.prisma.$transaction(async (tx) => {
    const updated = await tx.service.update({
      where: { id: serviceId },
      data: {
        minCapacity: dto.minCapacity,
        maxCapacity: dto.maxCapacity,
        isCompleted: true,

        // ✅ Service media (واحد فقط)
        files: {
          create: {
            fileUrl: serviceImage.url,
            fileType: serviceImage.fileType,
            publicId: serviceImage.publicId,
          },
        },

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
                    fromTime: slot.fromTime,
                    toTime: slot.toTime,
                    capacity: slot.capacity,
                  })),
                }
              : undefined,
          })),
        },

        // ✅ SubService (واحد فقط)
        subServices: {
          create: {
            name: dto.subService.name,
            description: dto.subService.description,
            pricePerUnit: dto.subService.pricePerUnit,
            unitType: dto.subService.unitType,
            dailyCapacity: dto.subService.dailyCapacity,

            // multiple media
          media: {
  create: subServiceMediaUploads.map((m) => ({
    url: m.url,
    type: m.fileType,
    publicId: m.publicId,
  })),
},
          },
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

    // Bank account
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

    return updated;
  });

  return {
    message: 'Service completed successfully',
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
              publicId: m.publicId,

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
                      fromTime: slot.fromTime,
                      toTime: slot.toTime,
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