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

  constructor(private readonly config: ConfigService) {
    // التحقق الفوري ومباشرة عند إنشاء الـ Service دون انتظار onModuleInit
    const secretKey = process.env.STRIPE_SECRET_KEY || this.config.get<string>('STRIPE_SECRET_KEY');
    this.currency = process.env.STRIPE_CURRENCY || this.config.get<string>('STRIPE_CURRENCY') ?? 'usd';
    if (secretKey) {
      try {
        this.stripe = new Stripe(secretKey);
        this._isAvailable = true;
      } catch (err) {
        this.logger.error(`[StripeGateway] Initialisation failed`);
      }
    }
  }
  

  

  onModuleInit(): void {
    // يمكن تركها للوجز فقط
  }


  get isAvailable(): boolean {
    return this._isAvailable;
  }

  async createIntent(payment: Payment): Promise<IntentResult> {
    console.log('DEBUG: _isAvailable value is:', this._isAvailable);
    console.log('DEBUG: stripe instance exists:', !!this.stripe);
    if (!this._isAvailable || !this.stripe) {
      console.log('DEBUG: Stripe gateway is NOT available or stripe instance is null');
      return { clientSecret: null, intentId: null };
    }
    try {
    const amountInCents = Math.round(payment.amount * 100);
    const intent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: this.currency,
      automatic_payment_methods: { enabled: true,allow_redirects: 'never' },
      metadata: { eventyPaymentId: payment.id },
    
    });
    
    console.log('DEBUG: Stripe Intent created successfully:', intent.id);
    return { clientSecret: intent.client_secret, intentId: intent.id };
      }catch (err: unknown) {
      // --- هذا الجزء هو المسؤول عن التقاط الطامة الكبرى وطباعتها ---
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[StripeGateway] createIntent failed: ${message}`);
      console.error('DEBUG: Stripe API Error Details:', message);
      
      return { clientSecret: null, intentId: null };
    }

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