import { Payment } from '@prisma/client';

export interface ChargeResult {
  success: boolean;
  providerReference?: string;
  failureReason?: string;
}

/**
 * Swappable electronic-payment gateway (docs/payments-implementation-plan.md §3).
 * `MockPaymentGatewayService` is the only implementation today; a real
 * processor (Stripe/PayTabs/Fawry/…) becomes a second implementation behind
 * this same abstraction later — nothing else in the codebase changes.
 */
export abstract class PaymentGatewayService {
  abstract charge(payment: Payment): Promise<ChargeResult>;
}
