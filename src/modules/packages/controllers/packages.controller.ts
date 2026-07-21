import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PackagesService } from '../packages.service';
import { CreatePackageDto } from '../dto/create-package.dto';
import { UpdatePackageDto } from '../dto/update-package.dto';
import { AttachServiceDto } from '../dto/attach-service.dto';
import { CreateServiceDto } from 'src/modules/services/dto/create-service.dto';

/**
 * Provider-facing Packages API (docs/packages-implementation-plan.md §5.1).
 */
@ApiTags('Provider Packages')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('provider/packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a package shell (Provider only)' })
  @ApiResponse({ status: 201, description: 'Package created successfully' })
  create(@Request() req, @Body() dto: CreatePackageDto) {
    return this.packagesService.createPackage(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my packages (Provider only)' })
  findMine(@Request() req) {
    return this.packagesService.listMyPackages(req.user.sub);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({ summary: 'Get package detail, including composed service list (Provider only)' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.packagesService.getPackageById(req.user.sub, id);
  }

  @Put(':id')
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({ summary: 'Edit package name/description (Provider only)' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packagesService.updatePackage(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({ summary: 'Delete a DRAFT/REJECTED package — the only way to remove its Hall (Provider only)' })
  remove(@Request() req, @Param('id') id: string) {
    return this.packagesService.deletePackage(req.user.sub, id);
  }

  @Post(':id/services/exclusive')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'serviceLogo', maxCount: 1 },
      { name: 'businessFile', maxCount: 1 },
      { name: 'subServiceMedia', maxCount: 10 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({
    summary: 'Create + attach a package-exclusive service (Provider only)',
    description: 'Same body as POST /services. Forces isPackaged=true and links it to this package (docs §5.3).',
  })
  async createExclusiveService(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CreateServiceDto,
    @UploadedFiles()
    files: {
      serviceLogo?: Express.Multer.File[];
      businessFile?: Express.Multer.File[];
      subServiceMedia?: Express.Multer.File[];
    },
  ) {
    return this.packagesService.createExclusiveService(
      req.user.sub,
      id,
      dto,
      files?.serviceLogo?.[0],
      files?.businessFile?.[0],
      files?.subServiceMedia,
    );
  }

  @Post(':id/services/attach')
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({
    summary: 'Attach one of the caller\'s own existing public services (Provider only)',
    description: 'Same-provider only — see docs §2.3, §2.5.',
  })
  attachService(@Request() req, @Param('id') id: string, @Body() dto: AttachServiceDto) {
    return this.packagesService.attachExistingService(req.user.sub, id, dto);
  }

  @Delete(':id/services/:serviceId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiParam({ name: 'serviceId', description: 'Service ID to remove from the package' })
  @ApiOperation({
    summary: 'Remove a non-Hall service from the package (Provider only)',
    description: 'Always rejected for the Hall service — see docs §8.1.',
  })
  removeService(@Request() req, @Param('id') id: string, @Param('serviceId') serviceId: string) {
    return this.packagesService.removeService(req.user.sub, id, serviceId);
  }

  @Delete(':id/pending-change')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({ summary: 'Cancel a scheduled non-Hall edit before it applies (Provider only)', description: 'See docs §9.' })
  cancelPendingChange(@Request() req, @Param('id') id: string) {
    return this.packagesService.cancelPendingChange(req.user.sub, id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({ summary: 'Submit the package for admin approval (Provider only)', description: 'See docs §7.' })
  submit(@Request() req, @Param('id') id: string) {
    return this.packagesService.submitPackage(req.user.sub, id);
  }
}
