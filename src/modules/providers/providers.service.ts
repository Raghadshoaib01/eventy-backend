import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * 📋 API #5: GET Provider Profile
   */
  //   async getProfile(userId: string) {
  //     const user = await this.prisma.user.findUnique({
  //       where: { id: userId },
  //       include: {
  //         provider: {
  //           include: {
  //             services: {
  //               include: {
  //                 subServices: true,
  //                 serviceType:true,
  //                 eventTypes: true,
  //               },
  //             },
  //           },
  //         },
  //         bankAccount: true,
  //       },
  //     });

  //     if (!user || !user.provider) {
  //       throw new NotFoundException('Provider not found');
  //     }

  //     return {
  //       id: user.id,
  //       fullName: user.fullName,
  //       email: user.email,
  //       phoneNumber: user.phoneNumber,
  //       profileImage: user.profileImage,
  //       status: user.status,
  //       emailVerified: user.emailVerified,

  //       // Business Info
  //       businessName: user.provider.businessName,
  //       businessLicense: user.provider.businessLicense,
  //       approvalStatus: user.provider.approvalStatus,

  //       // Location
  //       // latitude: user.provider.latitude,
  //       // longitude: user.provider.longitude,
  //       // locationName: user.provider.locationName,

  //       // Bank Account
  //       bankAccount: user.bankAccount
  //         ? {
  //             iban: user.bankAccount.iban,
  //             bankName: user.bankAccount.bankName,
  //             accountHolderName: user.bankAccount.accountHolderName,
  //             isVerified: user.bankAccount.isVerified,
  //           }
  //         : null,

  //       // Services Summary
  //       servicesCount: user.provider.services.length,
  //       services: user.provider.services.map((s) => ({
  //         id: s.id,
  //         serviceType: s.serviceType.name,
  //         eventTypes: s.eventTypes,
  //         description: s.description,
  //         //isActive: s.approvalStatus,
  //         approvalStatus: s.approvalStatus,
  //         subServicesCount: s.subServices.length,
  //       })),
  //     };
  //   }

  //   /**
  //    * ✏️ API #6: PATCH Provider Profile
  //    */
  //   async updateProfile(
  //     userId: string,
  //     dto: UpdateProviderDto,
  //     profileImage?: Express.Multer.File,
  //   ) {
  //     const user = await this.prisma.user.findUnique({
  //       where: { id: userId },
  //       include: { provider: true },
  //     });

  //     if (!user || !user.provider) {
  //       throw new NotFoundException('Provider not found');
  //     }

  //     // رفع صورة جديدة إن وُجدت
  //     let profileImageUrl = user.profileImage;
  //     if (profileImage) {
  //       // حذف الصورة القديمة
  //       if (user.profileImage) {
  //         const oldPublicId = this.cloudinaryService.extractPublicId(
  //           user.profileImage,
  //         );
  //         await this.cloudinaryService.delete(oldPublicId);
  //       }

  //       // رفع الجديدة
  //       const uploaded = await this.cloudinaryService.upload(profileImage, {
  //         folder: 'eventy/profiles',
  //       });
  //       profileImageUrl = uploaded.url;
  //     }

  //     // تحديث User
  //     await this.prisma.user.update({
  //       where: { id: userId },
  //       data: {
  //         fullName: dto.fullName,
  //         phoneNumber: dto.phoneNumber,
  //         profileImage: profileImageUrl,
  //       },
  //     });

  //     // تحديث Provider
  //     await this.prisma.serviceProvider.update({
  //       where: { id: user.provider.id },
  //       data: {
  //         businessName: dto.businessName,
  //        // latitude: dto.latitude,
  //        // longitude: dto.longitude,
  //         //locationName: dto.locationName,
  //       },
  //     });

  //     return {
  //       message: 'Profile updated successfully',
  //       data: null,
  //     };
  //   }
}
