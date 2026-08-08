// src/modules/suggested-packages/suggested-packages.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SuggestedPackagesService } from './suggested-packages.service';
import { CreateSuggestedPackageDto } from './dto/create-suggested-package.dto';
import { UpdateSuggestedPackageDto } from './dto/update-suggested-package.dto';

/**
 * Swagger organization: endpoints are split into two role-scoped tags:
 *   • `Packages-Admin`    — `/admin/suggested-packages` (guarded with
 *                            `@Roles(UserRole.ADMIN)`)
 *   • `Packages-Customer` — `/suggested-packages` (any authenticated
 *                            CUSTOMER browsing public catalog)
 *
 * The controller-level `@ApiTags` is intentionally omitted; each handler
 * carries its own tag so Swagger groups them by role.
 */
@ApiBearerAuth('JWT-auth')
@Controller()
export class SuggestedPackagesController {
  constructor(private readonly suggestedPackagesService: SuggestedPackagesService) {}

  // �═══════════════════════════════════════════════════════════════════
  // ADMIN APIs (path: /admin/suggested-packages)
  // ════════════════════════════════════════════════════════════════════

  @Post('admin/suggested-packages')
  @ApiTags('Packages-Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Admin] Create a suggested package',
    description: '**Allowed roles:** ADMIN.',
  })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@Request() req, @Body() dto: CreateSuggestedPackageDto) {
    return this.suggestedPackagesService.create(req.user.sub, dto);
  }

  @Get('admin/suggested-packages')
  @ApiTags('Packages-Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[Admin] List all suggested packages',
    description: '**Allowed roles:** ADMIN.',
  })
  listAll() {
    return this.suggestedPackagesService.listAll();
  }

  @Get('admin/suggested-packages/:id')
  @ApiTags('Packages-Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiParam({ name: 'id', description: 'Suggested package UUID' })
  @ApiOperation({
    summary: '[Admin] Get a suggested package',
    description: '**Allowed roles:** ADMIN.',
  })
  getAdminById(@Param('id') id: string) {
    return this.suggestedPackagesService.getById(id);
  }

  @Patch('admin/suggested-packages/:id')
  @ApiTags('Packages-Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiParam({ name: 'id', description: 'Suggested package UUID' })
  @ApiOperation({
    summary: '[Admin] Update a suggested package',
    description: '**Allowed roles:** ADMIN.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateSuggestedPackageDto) {
    return this.suggestedPackagesService.update(id, dto);
  }

  @Patch('admin/suggested-packages/:id/deactivate')
  @ApiTags('Packages-Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Suggested package UUID' })
  @ApiOperation({
    summary: '[Admin] Deactivate a suggested package',
    description: '**Allowed roles:** ADMIN.',
  })
  deactivate(@Param('id') id: string) {
    return this.suggestedPackagesService.deactivate(id);
  }

  @Delete('admin/suggested-packages/:id')
  @ApiTags('Packages-Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Suggested package UUID' })
  @ApiOperation({
    summary: '[Admin] Delete a suggested package',
    description: '**Allowed roles:** ADMIN.',
  })
  remove(@Param('id') id: string) {
    return this.suggestedPackagesService.delete(id);
  }

  // ════════════════════════════════════════════════════════════════════
  // CUSTOMER APIs (path: /suggested-packages)
  // �═══════════════════════════════════════════════════════════════════

  @Get('suggested-packages')
  @ApiTags('Packages-Customer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all ACTIVE suggested packages (customer browse)',
    description: '**Allowed roles:** any authenticated user (typically CUSTOMER).',
  })
  listActive() {
    return this.suggestedPackagesService.listActive();
  }

  @Get('suggested-packages/:id')
  @ApiTags('Packages-Customer')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: 'Suggested package UUID' })
  @ApiOperation({
    summary: 'Get an ACTIVE suggested package',
    description: '**Allowed roles:** any authenticated user (typically CUSTOMER).',
  })
  getCustomerById(@Param('id') id: string) {
    return this.suggestedPackagesService.getActiveById(id);
  }
}
