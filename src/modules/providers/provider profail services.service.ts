import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { UpdateProviderProfileDto, UpdateBankAccountDto } from '../providers/dto/Update provider profile.dto';


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
                media: true,
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

  /**
   * تحديث معلومات Provider Profile
   * يمكن تحديث: fullName, phoneNumber, businessName, description, location
   */
  async updateProviderProfile(
    userId: string,
    dto: UpdateProviderProfileDto,
    profileImage?: Express.Multer.File,
  ) {
    // 1. التحقق من وجود المستخدم
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    // 2. رفع الصورة الجديدة إن وُجدت
    let profileImageUrl = user.profileImage;
    if (profileImage) {
      // حذف الصورة القديمة إن وُجدت
      if (user.profileImage) {
        const oldPublicId = this.cloudinaryService.extractPublicId(user.profileImage);
        await this.cloudinaryService.delete(oldPublicId);
      }

      // رفع الصورة الجديدة
      const uploaded = await this.cloudinaryService.upload(profileImage, {
        folder: 'eventy/profiles',
      });
      profileImageUrl = uploaded.url;
    }

    // 3. تحديث User
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        profileImage: profileImageUrl,
      },
    });

    // 4. تحديث Provider
    const updatedProvider = await this.prisma.serviceProvider.update({
      where: { id: user.provider.id },
      data: {
        businessName: dto.businessName,
        description: dto.description,
        locationName: dto.locationName,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    return {
      message: 'Provider profile updated successfully',
      data: {
        user: updatedUser,
        provider: updatedProvider,
      },
    };
  }

  /**
   * إضافة أو تحديث Bank Account
   * يُستخدم بعد قبول الحساب
   */
  async updateBankAccount(userId: string, dto: UpdateBankAccountDto) {
    // 1. التحقق من وجود المستخدم
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { 
        provider: true,
        bankAccount: true,
      },
    });

    if (!user || !user.provider) {
      throw new NotFoundException('Provider not found');
    }

    // 2. التحقق من أن Provider مقبول
    if (user.provider.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Your account must be approved before adding bank account');
    }

    // 3. إنشاء أو تحديث BankAccount
    let bankAccount;
    if (user.bankAccount) {
      // تحديث
      bankAccount = await this.prisma.bankAccount.update({
        where: { id: user.bankAccount.id },
        data: {
          iban: dto.iban,
          bankName: dto.bankName,
          accountHolderName: dto.accountHolderName,
          isVerified: false, // يحتاج إعادة تحقق
        },
      });
    } else {
      // إنشاء جديد
      bankAccount = await this.prisma.bankAccount.create({
        data: {
          iban: dto.iban,
          bankName: dto.bankName,
          accountHolderName: dto.accountHolderName,
          isVerified: false,
          userId: userId,
        },
      });
    }

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
    if (service.approvalStatus === 'APPROVED') {
      throw new BadRequestException('Cannot delete an approved service. Contact admin.');
    }

    // حذف جميع الملفات من Cloudinary
    // 1. Service Media
    for (const files of service.files) {
      await this.cloudinaryService.delete(media.publicId);
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
  }
}