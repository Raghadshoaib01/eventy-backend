// import {
//   Controller,
//   Post,
//   Body,
//   Param,
//   UseGuards,
//   Request,
//   UseInterceptors,
//   UploadedFiles,
// } from '@nestjs/common';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiResponse,
//   ApiBearerAuth,
//   ApiConsumes,
//   ApiParam,
// } from '@nestjs/swagger';
// import { FilesInterceptor } from '@nestjs/platform-express';
// import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
// // import { ServiceDetailsService } from '../service details.service';
// import {
//   CompleteServiceDetailsDto,
//   CompleteHallSoundDetailsDto
// } from '../dto/Complete service details.dto'

// @ApiTags('Service Details')
// @Controller('services')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth('JWT-auth')
// export class ServiceDetailsController {
//   constructor(private readonly serviceDetailsService: ServiceDetailsService) {}

//   // ========== إكمال تفاصيل خدمة (FOOD, PHOTOGRAPHY, FAVORS, DECORATION) ==========
//   @Post(':serviceId/complete-details')
//   @UseInterceptors(FilesInterceptor('media', 10))
//   @ApiConsumes('multipart/form-data')
//   @ApiOperation({
//     summary: 'Complete service details after approval (FOOD, PHOTOGRAPHY, FAVORS, DECORATION)',
//     description: 'Add availability schedule and optional media. After this, you can add sub-services.',
//   })
//   @ApiParam({ name: 'serviceId', description: 'Service ID' })
//   @ApiResponse({
//     status: 200,
//     description: 'Service details completed. You can now add sub-services.'
//   })
//   @ApiResponse({
//     status: 400,
//     description: 'Account not approved or wrong service type'
//   })
//   async completeServiceDetails(
//     @Request() req,
//     @Param('serviceId') serviceId: string,
//     @Body() dto: CompleteServiceDetailsDto,
//     @UploadedFiles() media?: Express.Multer.File[],
//   ) {
//     const providerId = req.user.sub;
//     return this.serviceDetailsService.completeServiceDetails(
//       providerId,
//       serviceId,
//       dto,
//       media,
//     );
//   }

//   // ========== إكمال تفاصيل Hall/Sound ==========
//   @Post(':serviceId/complete-hall-sound')
//   @UseInterceptors(FilesInterceptor('media', 10))
//   @ApiConsumes('multipart/form-data')
//   @ApiOperation({
//     summary: 'Complete Hall/Sound service details after approval',
//     description: 'Add capacity, price, availability, and media. No sub-services needed.',
//   })
//   @ApiParam({ name: 'serviceId', description: 'Service ID' })
//   @ApiResponse({
//     status: 200,
//     description: 'Hall/Sound service completed successfully'
//   })
//   @ApiResponse({
//     status: 400,
//     description: 'Account not approved, wrong service type, or missing media'
//   })
//   async completeHallSoundDetails(
//     @Request() req,
//     @Param('serviceId') serviceId: string,
//     @Body() dto: CompleteHallSoundDetailsDto,
//     @UploadedFiles() media: Express.Multer.File[],
//   ) {
//     const providerId = req.user.sub;
//     return this.serviceDetailsService.completeHallSoundDetails(
//       providerId,
//       serviceId,
//       dto,
//       media,
//     );
//   }
// }
