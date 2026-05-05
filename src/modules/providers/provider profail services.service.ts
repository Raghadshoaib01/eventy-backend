import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { UpdateProviderProfileDto, UpdateBankAccountDto } from '../providers/dto/Update provider profile.dto';
import { fileURLToPath } from 'url';


@Injectable()
export class ProviderProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * الحصول على Profile كامل للـ Provider
   */
  async getProviderProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        provider: {
          include: {
            services: {
              include: {
                files: true,
                availability: {
                  include: {
                    timeSlots: true,
                  },
                },
                subServices: {
                  include: {
                  media: true,
                  },
                },
              },
            },
          },
        },
        bankAccount: true,
      },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    // إزالة الحقول الحساسة
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      message: 'Provider profile retrieved successfully',
      data: userWithoutPassword,
    };
  }

  // /**
  //  * تحديث معلومات Provider Profile
  //  * يمكن تحديث: fullName, phoneNumber, businessName, description, location
  //  */
 async updateProviderProfile(
  userId: string,
  dto: UpdateProviderProfileDto,
  profileImage?: Express.Multer.File,
) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { provider: true },
  });

  if (!user || !user.provider) {
    throw new NotFoundException('Provider not found');
  }

  // 🔐 شرط القبول
  if (user.provider.approvalStatus !== 'APPROVED') {
    throw new ForbiddenException(
      'You cannot update profile until admin approval',
    );
  }

  // 🖼️ الصورة
  let profileImageUrl = user.profileImage;

  if (profileImage) {
    if (user.profileImage) {
      const oldPublicId =
        this.cloudinaryService.extractPublicId(user.profileImage);
      await this.cloudinaryService.delete(oldPublicId);
    }

    const uploaded = await this.cloudinaryService.upload(profileImage, {
      folder: 'eventy/profiles',
    });

    profileImageUrl = uploaded.url;
  }

  // 👤 تحديث user
  const updatedUser = await this.prisma.user.update({
    where: { id: userId },
    data: {
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      profileImage: profileImageUrl,
      locationName: dto.locationName,
      latitude: dto.latitude,
      longitude: dto.longitude,
    },
  });

  // 🏢 تحديث provider
  const updatedProvider = await this.prisma.serviceProvider.update({
    where: { id: user.provider.id },
    data: {
      businessName: dto.businessName,
      description: dto.description,
    },
  });

  return {
    message: 'Profile updated successfully',
    data: {
      user: updatedUser,
      provider: updatedProvider,
    },
  };
}


async updateBankAccount(
  userId: string,
  dto: UpdateBankAccountDto,
) {
  // 1. التأكد أن المستخدم Provider
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { provider: true, bankAccount: true },
  });

  if (!user || !user.provider) {
    throw new NotFoundException('Provider not found');
  }

  // 2. شرط القبول
  if (user.provider.approvalStatus !== 'APPROVED') {
    throw new ForbiddenException(
      'You must be approved before adding a bank account',
    );
  }

  // 3. التأكد من وجود بيانات على الأقل
  if (
    dto.iban === undefined &&
    dto.bankName === undefined &&
    dto.accountHolderName === undefined
  ) {
    throw new BadRequestException('No data provided');
  }

  // 4. تنظيف البيانات (partial update)
  const data = Object.fromEntries(
    Object.entries({
      iban: dto.iban,
      bankName: dto.bankName,
      accountHolderName: dto.accountHolderName,
    }).filter(([_, value]) => value !== undefined),
  );

  // 5. التحقق من عدم وجود تغيير
  if (user.bankAccount) {
    const noChange =
      (dto.iban === undefined || dto.iban === user.bankAccount.iban) &&
      (dto.bankName === undefined || dto.bankName === user.bankAccount.bankName) &&
      (dto.accountHolderName === undefined ||
        dto.accountHolderName === user.bankAccount.accountHolderName);

    if (noChange) {
      throw new BadRequestException('No changes detected');
    }
  }

  // 6. upsert
  const bankAccount = await this.prisma.bankAccount.upsert({
    where: { userId },
    update: {
      ...data,
      isVerified: false, // أي تعديل يحتاج إعادة تحقق
    },
    create: {
      iban: dto.iban!,
      bankName: dto.bankName!,
      accountHolderName: dto.accountHolderName!,
      userId,
      isVerified: false,
    },
  });

  return {
    message: 'Bank account saved successfully',
    data: bankAccount,
  };
}


  

  /**
   * الحصول على جميع الخدمات للـ Provider
   */
  async getProviderServices(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const services = await this.prisma.service.findMany({
      where: { providerId: user.provider.id },
      include: {
        files: true,
        availability: {
          include: {
            timeSlots: true,
          
          },
        },
        subServices: {
          include: {
          media: true,        },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Services retrieved successfully',
      data: services,
    };
  }

  /**
   * الحصول على خدمة واحدة بالتفاصيل
   */
  async getServiceById(userId: string, serviceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        providerId: user.provider.id,
      },
      include: {
        files: true,
        availability: {
          include: {
            timeSlots: true,
          },
        },
        subServices: {
          include: {
            media: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found or you do not own this service');
    }

    return {
      message: 'Service retrieved successfully',
      data: service,
    };
  }

  /**
   * حذف خدمة (فقط إذا كانت PENDING أو REJECTED)
   */
  async deleteService(userId: string, serviceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        providerId: user.provider.id,
      },
      include: {
        files: true,
        subServices: {
          include: {
          media: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found or you do not own this service');
    }

    // لا يمكن حذف خدمة مقبولة
  if (service.approvalStatus === 'ACTIVE') {
  throw new BadRequestException(
    'Cannot delete an active service. Contact admin.',
  );}
  

    // حذف جميع الملفات من Cloudinary
    // 1. Service Media
  for (const file of service.files) {
  const publicId = this.cloudinaryService.extractPublicId(file.fileUrl);
  await this.cloudinaryService.delete(publicId);
}

    // 2. SubService Media
    for (const subService of service.subServices) {
      for (const media of subService.media) {
        await this.cloudinaryService.delete(media.publicId);
      }
    }

    // 3. حذف الخدمة (سيحذف تلقائياً SubServices, Media, Availability بسبب Cascade)
    await this.prisma.service.delete({
      where: { id: serviceId },
    });

    return {
      message: 'Service deleted successfully',
      data: null,
    };
  }

  /**
   * تبديل حالة Service (close/open for today)
   * يمكن استخدامها لإغلاق الخدمة ليوم واحد
   */
  async toggleServiceAvailability(userId: string, serviceId: string, isOpen: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        providerId: user.provider.id,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found or you do not own this service');
    }

    // يمكن هنا إضافة logic لإغلاق الخدمة مؤقتاً
    // مثلاً: إضافة حقل `isTemporarilyClosed` في Service model
    // أو: تعديل `capacity` في ServiceAvailability لليوم الحالي

    return {
      message: `Service ${isOpen ? 'opened' : 'closed'} successfully`,
      data: { serviceId, isOpen },
    };
  }}