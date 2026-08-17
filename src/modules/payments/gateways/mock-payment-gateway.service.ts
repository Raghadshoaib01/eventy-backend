// src/modules/payments/gateways/mock-payment-gateway.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Payment } from '@prisma/client';
import { ChargeResult, IntentResult, PaymentGatewayService } from './payment-gateway.service';

@Injectable()
export class MockPaymentGatewayService implements PaymentGatewayService {
  private readonly logger = new Logger(MockPaymentGatewayService.name);

  readonly isAvailable = true; // always usable as a fallback

  async charge(payment: Payment): Promise<ChargeResult> {
    if (payment.amount <= 0) {
      return { success: false, failureReason: 'Invalid charge amount' };
    }
    const paymentIntentId = `pi_${randomBytes(12).toString('hex')}`;
    const chargeId = `ch_${randomBytes(12).toString('hex')}`;
    this.logger.debug(`[MockGateway] Simulated charge — ${paymentIntentId}:${chargeId}`);
    return { success: true, providerReference: `${paymentIntentId}:${chargeId}` };
  }

  /** No real gateway connected — signals the caller to fall back to charge(). */
  async createIntent(): Promise<IntentResult> {
    return { clientSecret: null, intentId: null };
  }

  async verifyIntent(): Promise<ChargeResult> {
    return { success: false, failureReason: 'Mock gateway has no real intents to verify' };
  }
}