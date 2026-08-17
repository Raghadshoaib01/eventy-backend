// src/modules/payments/gateways/stripe-payment-gateway.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Payment } from '@prisma/client';
import { ChargeResult, IntentResult, PaymentGatewayService } from './payment-gateway.service';

@Injectable()
export class StripePaymentGatewayService implements PaymentGatewayService, OnModuleInit {
  private readonly logger = new Logger(StripePaymentGatewayService.name);
  private stripe: Stripe | null = null;
  private currency = 'usd';
  private _isAvailable = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.currency = this.config.get<string>('STRIPE_CURRENCY') ?? 'usd';
    console.log('Stripe key exists:', !!secretKey);
    console.log('Stripe key prefix:', secretKey?.slice(0, 8));

    if (!secretKey) {
      this.logger.warn(
        '[StripeGateway] STRIPE_SECRET_KEY not set — falling back to mock gateway.',
      );
      return;
    }

    try {
      this.stripe = new Stripe(secretKey,);
      this._isAvailable = true;
      this.logger.log('[StripeGateway] Initialised successfully (test mode).');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[StripeGateway] Initialisation failed: ${message}`);
    }
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  async createIntent(payment: Payment): Promise<IntentResult> {
    if (!this._isAvailable || !this.stripe) {
      return { clientSecret: null, intentId: null };
    }
    const amountInCents = Math.round(payment.amount * 100);
    const intent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: this.currency,
      automatic_payment_methods: { enabled: true },
      metadata: { eventyPaymentId: payment.id },
    });
    return { clientSecret: intent.client_secret, intentId: intent.id };
  }

  async verifyIntent(intentId: string): Promise<ChargeResult> {
    if (!this._isAvailable || !this.stripe) {
      return { success: false, failureReason: 'Stripe gateway not available' };
    }
    try {
      const intent = await this.stripe.paymentIntents.retrieve(intentId);
      if (intent.status === 'succeeded') {
        return { success: true, providerReference: intent.id };
      }
      return { success: false, failureReason: `Payment status: ${intent.status}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[StripeGateway] verifyIntent failed: ${message}`);
      return { success: false, failureReason: message };
    }
  }

  async charge(payment: Payment): Promise<ChargeResult> {
    if (!this._isAvailable || !this.stripe) {
      return { success: false, failureReason: 'Stripe gateway not available' };
    }
    if (payment.amount <= 0) {
      return { success: false, failureReason: 'Invalid charge amount' };
    }
    try {
      const amountInCents = Math.round(payment.amount * 100);
      const intent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: this.currency,
        payment_method: 'pm_card_visa',
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { eventyPaymentId: payment.id },
      });
      if (intent.status === 'succeeded') {
        return { success: true, providerReference: intent.id };
      }
      return { success: false, failureReason: `Payment status: ${intent.status}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, failureReason: message };
    }
  }
}