// import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
// import { PrismaService } from 'src/database/prisma.service';
// import { CloudinaryService } from 'src/shared/services/cloudinary.service';
// import { CreateSubServiceDto } from './dto/create-sub-service.dto';
// import {FileType} from '@prisma/client'; 


// @Injectable()
// export class SubServiceService {
//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly cloudinaryService: CloudinaryService,
//   ) {}

//   /**
//    * إضافة SubService لخدمة موجودة
//    * يُستخدم فقط لـ FOOD, PHOTOGRAPHY, FAVORS, DECORATION
//    */
//   async createSubService(
//     providerId: string,
//     serviceId: string,
//     dto: CreateSubServiceDto,
//     media: Express.Multer.File[],
//   ) {
//     // 1. التحقق من ملكية الخدمة
//     const service = await this.prisma.service.findFirst({
//       where: {
//         id: serviceId,
//         providerId: providerId,
//       },
//     });

//     if (!service) {
//       throw new NotFoundException('Service not found or you do not own this service');
//     }

//     // 2. التحقق من أن نوع الخدمة يسمح بـ SubServices
//     const allowedTypes = ['FOOD', 'PHOTOGRAPHY', 'FAVORS', 'DECORATION'];
//     if (!allowedTypes.includes(service.serviceType)) {
//       throw new BadRequestException(
//         `Sub-services are not allowed for ${service.serviceType}. Only FOOD, PHOTOGRAPHY, FAVORS, DECORATION support sub-services.`
//       );
//     }

//     // 3. التحقق من أن الخدمة مكتملة التفاصيل
//     if (!service.isCompleted) {
//       throw new BadRequestException(
//         'Please complete service details first before adding sub-services'
//       );
//     }

//     // 4. التحقق من وجود ملفات (على الأقل صورة واحدة مطلوبة)
//     if (!media || media.length === 0) {
//       throw new BadRequestException('At least one image or video is required for sub-service');
//     }

// const uploadedMedia = await Promise.all(
//   media.map(async (file) => {
//     const uploaded = await this.cloudinaryService.upload(file, {
//       folder: 'eventy/services',
//     });
//     return {
//       url: uploaded.url,
//       type: file.mimetype.startsWith('video') ? FileType.VIDEO : FileType.IMAGE,  // ✅ استخدم enum
//       publicId: uploaded.publicId,
//     };
//   }),
// );

//     // 6. إنشاء SubService مع الملفات
//     const subService = await this.prisma.subService.create({
//       data: {
//         name: dto.name,
//         description: dto.description,
//         pricePerUnit: dto.pricePerUnit,
//         unitType: dto.unitType as any,
//         dailyCapacity: dto.dailyCapacity,
//         serviceId: serviceId,
//         media: {
//           create: uploadedMedia,
//         },
//       },
//       include: {
//         media: true,
//       },
//     });

//     return {
//       message: 'Sub-service created successfully',
//       data: subService,
//     };
//   }

//   /**
//    * الحصول على جميع SubServices لخدمة معينة
//    */
//   async getSubServicesByService(serviceId: string) {
//     const subServices = await this.prisma.subService.findMany({
//       where: { serviceId },
//       include: {
//         media: true,
//       },
//       orderBy: { createdAt: 'desc' },
//     });

//     return {
//       message: 'Sub-services retrieved successfully',
//       data: subServices,
//     };
//   }

//   /**
//    * حذف SubService
//    */
//   async deleteSubService(providerId: string, subServiceId: string) {
//     // التحقق من الملكية
//     const subService = await this.prisma.subService.findFirst({
//       where: {
//         id: subServiceId,
//         service: {
//           providerId: providerId,
//         },
//       },
//       include: {
//         media: true,
//       },
//     });

//     if (!subService) {
//       throw new NotFoundException('Sub-service not found or you do not own it');
//     }

//     // حذف الملفات من Cloudinary
//     for (const mediaItem of subService.media) {
//       await this.cloudinaryService.delete(mediaItem.publicId);
//     }

//     // حذف SubService
//     await this.prisma.subService.delete({
//       where: { id: subServiceId },
//     });

//     return {
//       message: 'Sub-service deleted successfully',
//       data: null,
//     };
//   }
// */
// }