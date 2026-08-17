import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PaymentsService } from '../payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';

/**
 * Customer-facing Payments API (docs/payments-implementation-plan.md §6.1).
 */
@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Pay for a confirmed standalone booking' })
  create(@Request() req, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(req.user.sub, dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiOperation({ summary: 'Payment status/detail' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.paymentsService.getPayment(req.user.sub, id);
  }

@Post(':id/confirm')
@ApiParam({ name: 'id', description: 'Payment ID' })
@ApiOperation({ summary: 'Confirm a payment after client-side Payment Sheet success' })
confirm(@Request() req, @Param('id') id: string) {
  return this.paymentsService.confirmPayment(req.user.sub, id);
}
}
