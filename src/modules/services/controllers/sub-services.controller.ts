import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { SubServiceService } from '../sub-services.service';
import { CreateSubServiceDto } from '../dto/create-sub-service.dto';

@ApiTags('Sub-Services')
@Controller('services/:serviceId/sub-services')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SubServiceController {
  constructor(private readonly subServiceService: SubServiceService) {}

  // ========== إضافة SubService ==========
  @Post()
  @UseInterceptors(FilesInterceptor('media', 10)) // max 10 files
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Add sub-service to existing service',
    description: 'Only for FOOD, PHOTOGRAPHY, FAVORS, DECORATION. Requires at least 1 image/video.',
  })
  @ApiParam({ name: 'serviceId', description: 'Service ID' })
  @ApiResponse({ status: 201, description: 'Sub-service created successfully' })
  @ApiResponse({ status: 400, description: 'Service type does not support sub-services or service not completed' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async createSubService(
    @Request() req,
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateSubServiceDto,
    @UploadedFiles() media: Express.Multer.File[],
  ) {
    const providerId = req.user.sub;
    return this.subServiceService.createSubService(providerId, serviceId, dto, media);
  }

  // ========== الحصول على جميع SubServices للخدمة ==========
  @Get()
  @ApiOperation({ summary: 'Get all sub-services for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service ID' })
  @ApiResponse({ status: 200, description: 'Sub-services retrieved successfully' })
  async getSubServices(@Param('serviceId') serviceId: string) {
    return this.subServiceService.getSubServicesByService(serviceId);
  }

  // ========== حذف SubService ==========
  @Delete(':subServiceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete sub-service' })
  @ApiParam({ name: 'serviceId', description: 'Service ID' })
  @ApiParam({ name: 'subServiceId', description: 'Sub-service ID to delete' })
  @ApiResponse({ status: 200, description: 'Sub-service deleted successfully' })
  @ApiResponse({ status: 404, description: 'Sub-service not found' })
  async deleteSubService(
    @Request() req,
    @Param('subServiceId') subServiceId: string,
  ) {
    const providerId = req.user.sub;
    return this.subServiceService.deleteSubService(providerId, subServiceId);
  }
}