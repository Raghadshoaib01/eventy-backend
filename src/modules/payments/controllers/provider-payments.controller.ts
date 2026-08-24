// src/modules/payments/controllers/provider-payments.controller.ts
// استبدال كامل المحتوى بهذا (تعديل الـ Swagger فقط ليعكس السلوك الموحّد):

import { Controller, HttpCode, HttpStatus, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PaymentsService } from '../payments.service';
import { Audit } from 'src/common/decorators/audit.decorator';
import { AuditAction } from '@prisma/client';

/**
 * Provider-facing Payments API (docs/payments-implementation-plan.md §6.2).
 *
 * Single unified endpoint for confirming cash payments — works for both a
 * regular Booking's payment and a PackageEventBooking's payment. The
 * caller always passes the Payment ID; PaymentsService.markCashPaid()
 * branches internally based on whether the payment belongs to a booking
 * or a package booking.
 */
@ApiTags('Provider Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('provider/payments')
export class ProviderPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Patch(':id/mark-cash-paid')
  @Audit({ action: AuditAction.UPDATE, entity: 'Payment', entityIdKey: 'id' })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Payment ID — works for both a regular booking payment and a package booking payment' })
  @ApiOperation({
    summary: 'Confirm a cash payment was received',
    description:
      'Unified cash-confirmation endpoint. Pass the Payment ID regardless of ' +
      'whether it belongs to a standalone Booking or a PackageEventBooking — ' +
      'the correct progression (booking → IN_PROGRESS, or package booking → ' +
      'IN_PROGRESS with partner notifications) is resolved automatically.',
  })
  @ApiResponse({ status: 200, description: 'Cash payment confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Payment is not CASH or not in a confirmable status' })
  @ApiResponse({ status: 403, description: 'Access denied — not the owning provider' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  markCashPaid(@Request() req, @Param('id') id: string) {
    return this.paymentsService.markCashPaid(req.user.sub, id);
  }
}