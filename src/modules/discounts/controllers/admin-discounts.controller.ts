import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DiscountsService } from '../discounts.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';

/**
 * Admin-facing Discounts API (docs/discounts-implementation-plan.md §6.2).
 */
@ApiTags('Admin - Discounts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/discounts')
export class AdminDiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a company-funded discount on any service or package' })
  create(@Request() req, @Body() dto: CreateDiscountDto) {
    return this.discountsService.createCompanyFundedDiscount(req.user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Discount ID' })
  @ApiOperation({ summary: 'Cancel any discount' })
  cancel(@Param('id') id: string) {
    return this.discountsService.cancelByAdmin(id);
  }
}
