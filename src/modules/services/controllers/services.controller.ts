import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  HttpCode, HttpStatus,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ServicesService } from '../services.service';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { CreateServiceTypeDto } from '../dto/create-service-type.dto';
import { AvailableServicesQueryDto } from '../dto/available-services-query.dto';
import { ServiceDetailQueryDto } from '../dto/service-detail-query.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@ApiTags('Services')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ════════════════════════════════
  // GET /services/service-types
  // ════════════════════════════════
  @Get('service-types')
  @Public()
  @ApiOperation({ summary: 'Get all service types (public — no auth required)' })
  @ApiResponse({ status: 200, description: 'Service types retrieved successfully' })
  getAllServiceTypes() {
    return this.servicesService.getAllServiceTypes();
  }

  // ════════════════════════════════
  // POST /services/service-types
  // ════════════════════════════════
  @Post('service-types')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create new service type (Admin only)' })
  @ApiResponse({ status: 201, description: 'Service type created successfully' })
  @ApiResponse({ status: 409, description: 'Service type already exists' })
  createServiceType(@Body() dto: CreateServiceTypeDto) {
    return this.servicesService.createServiceType(dto);
  }

  // ════════════════════════════════
  // DELETE /services/service-types/:typeId
  // ════════════════════════════════
  @Delete('service-types/:typeId')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete service type (Admin only)' })
  @ApiParam({ name: 'typeId', description: 'Service type ID' })
  @ApiResponse({ status: 200, description: 'Service type deleted successfully' })
  @ApiResponse({ status: 400, description: 'Service type is in use by existing services' })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  deleteServiceType(@Param('typeId') typeId: string) {
    return this.servicesService.deleteServiceType(typeId);
  }
  
  // ========================
  // ➕ Create Service
  // ========================
  @Post()
  @UseInterceptors(
  FileFieldsInterceptor([
    {
      name: 'serviceMedia',
      maxCount: 10,
    },
    {
      name: 'subServiceMedia',
      maxCount: 10,
    },
  ]),
)
@ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create new service (Provider only)' })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
  async createService(
  @Request() req,

  @Body()
  dto: CreateServiceDto,

  @UploadedFiles()
  files: {
    serviceMedia?: Express.Multer.File[];
    subServiceMedia?: Express.Multer.File[];
  },
) {
  return this.servicesService.createService(
    req.user.sub,
    dto,
    files,
  );
}
   // ========================
  //  All available Services
  // ========================
@Get('available')
@Public()
@ApiOperation({
  summary: 'Search available services (public)',
  description:
    'All filters optional. budget requires guests. ' +
    'Returns all active completed services when no filter provided.',
})
@ApiResponse({ status: 200, description: 'Available services retrieved' })
@ApiResponse({ status: 400, description: 'budget provided without guests' })
getAvailableServicesByType(@Query() dto: AvailableServicesQueryDto) {
  return this.servicesService.getAvailableServicesByType(dto);
}
  // ========================
  // 📄 Get Service By ID
  // ========================
  @Get(':id')
  @ApiOperation({ summary: 'Get service by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  getServiceById(@Request() req, @Param('id') serviceId: string,
  @Query() query: ServiceDetailQueryDto,       // ← أضيفي هذا
) {
    return this.servicesService.getServiceById(req.user.sub, serviceId , query);
  }

  // ========================
  // ✏️ Update Service
  // ========================
  @Put(':id')
  @ApiOperation({ summary: 'Update service (Provider only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  updateService(
    @Request() req,
    @Param('id') serviceId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.updateService(
      req.user.sub,
      serviceId,
      dto,
    );
  }

  // ========================
  // 🗑️ Delete Service
  // ========================
  @Delete(':id')
  @ApiOperation({ summary: 'Delete service (Provider only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  deleteService(@Request() req, @Param('id') serviceId: string) {
    return this.servicesService.deleteService(req.user.sub, serviceId);
  }

  
}