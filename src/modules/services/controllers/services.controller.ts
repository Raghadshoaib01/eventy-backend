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
} from '@nestjs/common';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ServicesService } from '../services.service';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';

@ApiTags('Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ========================
  // ➕ Create Service
  // ========================
  @Post()
  @ApiOperation({ summary: 'Create new service (Provider only)' })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
  createService(@Request() req, @Body() dto: CreateServiceDto) {
    return this.servicesService.createService(req.user.id, dto);
  }

  // ========================
  // 📋 Get My Services
  // ========================
  @Get('my')
  @ApiOperation({ summary: 'Get all my services (Provider only)' })
  @ApiResponse({ status: 200 })
  getMyServices(@Request() req) {
    return this.servicesService.getMyServices(req.user.id);
  }

  // ========================
  // 📄 Get Service By ID
  // ========================
  @Get(':id')
  @ApiOperation({ summary: 'Get service by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  getServiceById(@Request() req, @Param('id') serviceId: string) {
    return this.servicesService.getServiceById(req.user.id, serviceId);
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
      req.user.id,
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
    return this.servicesService.deleteService(req.user.id, serviceId);
  }
}