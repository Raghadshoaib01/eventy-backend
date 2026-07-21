import { Controller, HttpCode, HttpStatus, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PaymentsService } from '../payments.service';

/**
 * Provider-facing Payments API (docs/payments-implementation-plan.md §6.2).
 */
@ApiTags('Provider Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('provider/payments')
export class ProviderPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Patch(':id/mark-cash-paid')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiOperation({ summary: 'Confirm a cash payment was received' })
  markCashPaid(@Request() req, @Param('id') id: string) {
    return this.paymentsService.markCashPaid(req.user.sub, id);
  }
}
