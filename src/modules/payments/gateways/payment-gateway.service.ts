// src/modules/payments/gateways/payment-gateway.service.ts
import { Payment } from '@prisma/client';

export interface ChargeResult {
  success: boolean;
  providerReference?: string;
  failureReason?: string;
}

export interface IntentResult {
  /** null when no real gateway is connected — caller should fall back to synchronous charge() */
  clientSecret: string | null;
  intentId: string | null;
}

/**
 * Swappable electronic-payment gateway (docs/payments-implementation-plan.md §3).
 * Two implementations exist behind this contract:
 *   - MockPaymentGatewayService: always available, synchronous, no clientSecret.
 *   - StripePaymentGatewayService: real Stripe test-mode, returns a real clientSecret
 *     for the mobile Payment Sheet flow.
 * The active implementation is resolved at runtime in payments.module.ts based on
 * whether STRIPE_SECRET_KEY is configured — callers never branch on which one is active.
 */
export abstract class PaymentGatewayService {
  /** Whether this implementation is backed by a real, reachable gateway. */
  abstract readonly isAvailable: boolean;

  /** Synchronous, immediate charge — used by the mock and as an admin/testing bypass. */
  abstract charge(payment: Payment): Promise<ChargeResult>;

  /** Creates an unconfirmed intent for client-side confirmation (mobile Payment Sheet). */
  abstract createIntent(payment: Payment): Promise<IntentResult>;

  /** Verifies an intent's final status after client-side confirmation. */
  abstract verifyIntent(intentId: string): Promise<ChargeResult>;
}