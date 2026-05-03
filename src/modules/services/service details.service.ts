// import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
// import { PrismaService } from 'src/database/prisma.service';
// import { CloudinaryService } from 'src/shared/services/cloudinary.service';
// import { 
//   CompleteServiceDetailsDto, 
//   CompleteHallSoundDetailsDto 
// } from '../services/dto/Complete service details.dto';

// @Injectable()
// export class ServiceDetailsService {
//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly cloudinaryService: CloudinaryService,
//   ) {}

//   /**
//    * إكمال تفاصيل الخدمة بعد القبول
//    * للخدمات: FOOD, PHOTOGRAPHY, FAVORS, DECORATION
//    */
//   async completeServiceDetails(
//     providerId: string,
//     serviceId: string,
//     dto: CompleteServiceDetailsDto,
//     media?: Express.Multer.File[],
//   ) {
//     // 1. التحقق من ملكية الخدمة وحالتها
//     const service = await this.prisma.service.findFirst({
//       where: {
//         id: serviceId,
//         providerId: providerId,
//       },
//       include: {
//         provider: true,
//       },
//     });

//     if (!service) {
//       throw new NotFoundException('Service not found or you do not own this service');
//     }

//     // 2. التحقق من أن Provider مقبول
//     if (service.provider.approvalStatus !== 'APPROVED') {
//       throw new BadRequestException('Your account must be approved before completing service details');
//     }

//     // 3. التحقق من نوع الخدمة
//     const allowedTypes = ['FOOD', 'PHOTOGRAPHY', 'FAVORS', 'DECORATION'];
//     if (!allowedTypes.includes(service.serviceType)) {
//       throw new BadRequestException(
//         `This endpoint is only for ${allowedTypes.join(', ')}. Use completeHallSoundDetails for HALL/SOUND.`
//       );
//     }

//     // 4. رفع الملفات إن وُجدت
//     let uploadedMedia: any[] = [];
//     if (media && media.length > 0) {
//       uploadedMedia = await Promise.all(
//         media.map(async (file) => {
//           const uploaded = await this.cloudinaryService.upload(file, {
//             folder: 'eventy/services',
//           });
//           return {
//             url: uploaded.url,
//             type: file.mimetype.startsWith('video') ? 'video' : 'image',
//             publicId: uploaded.publicId,
//           };
//         }),
//       );
//     }

//     // 5. تحديث الخدمة وإضافة التفاصيل
//     const updatedService = await this.prisma.service.update({
//       where: { id: serviceId },
//       data: {
//         minCapacity: dto.minCapacity,
//         maxCapacity: dto.maxCapacity,
//         isCompleted: true, // الآن الخدمة جاهزة لإضافة SubServices
//         // إضافة الملفات
//         media: uploadedMedia.length > 0 ? {
//           create: uploadedMedia,
//         } : undefined,
//         // إضافة الجدول الزمني
//         availability: {
//           create: dto.availability.map((avail) => ({
//             dayOfWeek: avail.dayOfWeek as any,
//             workFromTime: avail.workFromTime,
//             workToTime: avail.workToTime,
//             capacity: avail.capacity,
//             hasSlots: avail.hasSlots ?? false,
//             timeSlots: avail.timeSlots ? {
//               create: avail.timeSlots.map((slot) => ({
//                 startTime: slot.startTime,
//                 endTime: slot.endTime,
//                 capacity: slot.capacity,
//               })),
//             } : undefined,
//           })),
//         },
//       },
//       include: {
//         media: true,
//         availability: {
//           include: {
//             timeSlots: true,
//           },
//         },
//       },
//     });

//     return {
//       message: 'Service details completed successfully. You can now add sub-services.',
//       data: updatedService,
//     };
//   }

//   /**
//    * إكمال تفاصيل خدمة Hall أو Sound
//    * هذه الخدمات لا تحتاج SubServices
//    */
//   async completeHallSoundDetails(
//     providerId: string,
//     serviceId: string,
//     dto: CompleteHallSoundDetailsDto,
//     media: Express.Multer.File[],
//   ) {
//     // 1. التحقق من ملكية الخدمة
//     const service = await this.prisma.service.findFirst({
//       where: {
//         id: serviceId,
//         providerId: providerId,
//       },
//       include: {
//         provider: true,
//       },
//     });

//     if (!service) {
//       throw new NotFoundException('Service not found or you do not own this service');
//     }

//     // 2. التحقق من أن Provider مقبول
//     if (service.provider.approvalStatus !== 'APPROVED') {
//       throw new BadRequestException('Your account must be approved before completing service details');
//     }

//     // 3. التحقق من نوع الخدمة
//     if (!['HALL', 'SOUND'].includes(service.serviceType)) {
//       throw new BadRequestException(
//         'This endpoint is only for HALL or SOUND services. Use completeServiceDetails for others.'
//       );
//     }

//     // 4. التحقق من وجود ملفات (مطلوبة)
//     if (!media || media.length === 0) {
//       throw new BadRequestException('At least one image is required for Hall/Sound service');
//     }

//     // 5. رفع الملفات
//     const uploadedMedia = await Promise.all(
//       media.map(async (file) => {
//         const uploaded = await this.cloudinaryService.upload(file, {
//           folder: 'eventy/halls',
//         });
//         return {
//           url: uploaded.url,
//           type: file.mimetype.startsWith('video') ? 'video' : 'image',
//           publicId: uploaded.publicId,
//         };
//       }),
//     );

//     // 6. تحديث الخدمة بالتفاصيل الكاملة
//     const updatedService = await this.prisma.service.update({
//       where: { id: serviceId },
//       data: {
//         minCapacity: dto.minCapacity,
//         maxCapacity: dto.maxCapacity,
//         price: dto.price,
//         isCompleted: true, // الخدمة مكتملة (لا تحتاج SubServices)
//         media: {
//           create: uploadedMedia,
//         },
//         availability: {
//           create: dto.availability.map((avail) => ({
//             dayOfWeek: avail.dayOfWeek as any,
//             workFromTime: avail.workFromTime,
//             workToTime: avail.workToTime,
//             capacity: avail.capacity,
//             hasSlots: avail.hasSlots ?? false,
//             timeSlots: avail.timeSlots ? {
//               create: avail.timeSlots.map((slot) => ({
//                 startTime: slot.startTime,
//                 endTime: slot.endTime,
//                 capacity: slot.capacity,
//               })),
//             } : undefined,
//           })),
//         },
//       },
//       include: {
//         media: true,
//         availability: {
//           include: {
//             timeSlots: true,
//           },
//         },
//       },
//     });

//     return {
//       message: 'Hall/Sound service completed successfully',
//       data: updatedService,
//     };
//   }
// }