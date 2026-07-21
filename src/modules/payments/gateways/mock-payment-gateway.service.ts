import { Injectable } from '@nestjs/common';
import { Payment } from '@prisma/client';
import { ChargeResult, PaymentGatewayService } from './payment-gateway.service';

/**
 * Deterministic mock gateway for the graduation-project build
 * (docs/payments-implementation-plan.md §3). Always succeeds unless the
 * charged amount is exactly 0 or negative, which is enough to exercise both
 * the success and failure paths in tests without any external dependency.
 */
@Injectable()
export class MockPaymentGatewayService implements PaymentGatewayService {
  async charge(payment: Payment): Promise<ChargeResult> {
    if (payment.amount <= 0) {
      return { success: false, failureReason: 'Invalid charge amount' };
    }

    return {
      success: true,
      providerReference: `MOCK-${payment.id}-${Date.now()}`,
    };
  }
}
