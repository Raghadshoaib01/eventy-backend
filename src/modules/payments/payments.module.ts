// src/modules/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsController } from './controllers/payments.controller';
import { ProviderPaymentsController } from './controllers/provider-payments.controller';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentGatewayService } from './gateways/payment-gateway.service';
import { MockPaymentGatewayService } from './gateways/mock-payment-gateway.service';
import { StripePaymentGatewayService } from './gateways/stripe-payment-gateway.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { BookingsModule } from '../bookings/bookings.module';
import { PackagesModule } from '../packages/packages.module';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [BookingsModule, PackagesModule, DiscountsModule],
  controllers: [PaymentsController, ProviderPaymentsController, AdminPaymentsController],
  providers: [
    PaymentsService,
    DomainEventBus,
    MockPaymentGatewayService,
    StripePaymentGatewayService,
    {
      provide: PaymentGatewayService,
      useFactory: (stripe: StripePaymentGatewayService, mock: MockPaymentGatewayService) =>
        stripe.isAvailable ? stripe : mock,
      inject: [StripePaymentGatewayService, MockPaymentGatewayService],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}