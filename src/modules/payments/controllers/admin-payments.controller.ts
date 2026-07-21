import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { PaymentsService } from '../payments.service';
import { RefundPaymentDto } from '../dto/refund-payment.dto';

/**
 * Admin-facing Payments API (docs/payments-implementation-plan.md §6.3).
 */
@ApiTags('Admin - Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List/filter all payments' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: PaymentStatus,
    @Query('method') method?: PaymentMethod,
  ) {
    return this.paymentsService.listPayments({ page, limit, status, method });
  }

  @Patch(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiOperation({ summary: 'Manually refund a PAID payment (standalone bookings — see docs §5)' })
  refund(@Param('id') id: string, @Body() dto: RefundPaymentDto) {
    return this.paymentsService.refundPayment(id, dto);
  }
}
