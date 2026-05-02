import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ProviderProfileService } from '../providers/provider profail services.service';
import { UpdateProviderProfileDto, UpdateBankAccountDto } from '../providers/dto/Update provider profile.dto';

@ApiTags('Provider Profile')
@Controller('provider/profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProviderProfileController {
  constructor(private readonly providerProfileService: ProviderProfileService) {}

  // ========== 1. Get Provider Profile ==========
  @Get()
  @ApiOperation({
    summary: 'Get provider full profile',
    description: 'Returns user info, business info, services, and bank account',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider profile retrieved successfully',
  })
  async getProfile(@Request() req) {
    return this.providerProfileService.getProviderProfile(req.user.sub);
  }

  // ========== 2. Update Provider Profile ==========
  @Patch()
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update provider profile',
    description: 'Update name, phone, business name, description, location, and profile image',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', example: 'Ahmad Mohammad' },
        phoneNumber: { type: 'string', example: '+962791234567' },
        businessName: { type: 'string', example: 'Al-Noor Catering & Events' },
        description: { type: 'string', example: 'Premium catering services...' },
        locationName: { type: 'string', example: 'Amman, Jordan' },
        latitude: { type: 'number', example: 31.9539 },
        longitude: { type: 'number', example: 35.9106 },
        profileImage: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @Request() req,
    @Body() dto: UpdateProviderProfileDto,
    @UploadedFile() profileImage?: Express.Multer.File,
  ) {
    return this.providerProfileService.updateProviderProfile(
      req.user.sub,
      dto,
      profileImage,
    );
  }

  // ========== 3. Update Bank Account ==========
  @Post('bank-account')
  @ApiOperation({
    summary: 'Add or update bank account',
    description: 'Can only be done after account approval',
  })
  @ApiResponse({ status: 200, description: 'Bank account saved successfully' })
  @ApiResponse({ status: 403, description: 'Account must be approved first' })
  async updateBankAccount(@Request() req, @Body() dto: UpdateBankAccountDto) {
    return this.providerProfileService.updateBankAccount(req.user.sub, dto);
  }

  // ========== 4. Get All Provider Services ==========
  @Get('services')
  @ApiOperation({
    summary: 'Get all services for this provider',
    description: 'Returns all services with details, media, and sub-services',
  })
  @ApiResponse({ status: 200, description: 'Services retrieved successfully' })
  async getServices(@Request() req) {
    return this.providerProfileService.getProviderServices(req.user.sub);
  }

  // ========== 5. Get Single Service by ID ==========
  @Get('services/:serviceId')
  @ApiOperation({ summary: 'Get single service details' })
  @ApiParam({ name: 'serviceId', description: 'Service ID' })
  @ApiResponse({ status: 200, description: 'Service retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async getServiceById(@Request() req, @Param('serviceId') serviceId: string) {
    return this.providerProfileService.getServiceById(req.user.sub, serviceId);
  }

  // ========== 6. Delete Service ==========
  @Delete('services/:serviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete service',
    description: 'Can only delete PENDING or REJECTED services',
  })
  @ApiParam({ name: 'serviceId', description: 'Service ID' })
  @ApiResponse({ status: 200, description: 'Service deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete approved service',
  })
  async deleteService(@Request() req, @Param('serviceId') serviceId: string) {
    return this.providerProfileService.deleteService(req.user.sub, serviceId);
  }

  // ========== 7. Toggle Service Availability (Close/Open for today) ==========
  @Patch('services/:serviceId/toggle')
  @ApiOperation({
    summary: 'Close or open service for bookings',
    description: 'Temporarily close service for today',
  })
  @ApiParam({ name: 'serviceId', description: 'Service ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isOpen: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Service status updated' })
  async toggleServiceAvailability(
    @Request() req,
    @Param('serviceId') serviceId: string,
    @Body('isOpen') isOpen: boolean,
  ) {
    return this.providerProfileService.toggleServiceAvailability(
      req.user.sub,
      serviceId,
      isOpen,
    );
  }
}