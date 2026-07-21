import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { DiscountsService } from '../discounts.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';

/**
 * Provider-facing Discounts API (docs/discounts-implementation-plan.md §6.1).
 */
@ApiTags('Provider Discounts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('provider/discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a discount on my own service or my own package' })
  create(@Request() req, @Body() dto: CreateDiscountDto) {
    return this.discountsService.createProviderDiscount(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my discounts' })
  findMine(@Request() req) {
    return this.discountsService.listMyDiscounts(req.user.sub);
  }

  @Patch(':id/reconfirm')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Discount ID' })
  @ApiOperation({ summary: 'Re-confirm a discount suspended by a package composition change' })
  reconfirm(@Request() req, @Param('id') id: string) {
    return this.discountsService.reconfirm(req.user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Discount ID' })
  @ApiOperation({ summary: 'Cancel a discount I created' })
  cancel(@Request() req, @Param('id') id: string) {
    return this.discountsService.cancelByProvider(req.user.sub, id);
  }
}
