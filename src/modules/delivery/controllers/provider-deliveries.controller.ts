import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { DeliveryService } from '../delivery.service';
import { UpdateDeliveryStatusDto } from '../dto/update-delivery-status.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { FulfillmentStatus } from '@prisma/client';

/**
 * Provider-facing Delivery API (docs/delivery-implementation-plan.md §4.1).
 */
@ApiTags('Provider Deliveries')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('provider/deliveries')
export class ProviderDeliveriesController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get()
  @ApiOperation({ summary: 'List deliveries for my own bookings' })
  findMine(@Request() req, @Query() query: PaginationDto, @Query('status') status?: FulfillmentStatus) {
    return this.deliveryService.listForProvider(req.user.sub, { ...query, status });
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiOperation({ summary: 'Advance delivery status' })
  updateStatus(@Request() req, @Param('id') id: string, @Body() dto: UpdateDeliveryStatusDto) {
    return this.deliveryService.updateStatus(req.user.sub, id, dto);
  }
}
