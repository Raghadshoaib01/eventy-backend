// src/modules/packages/packages.module.ts
import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PackagesCronService } from './packages-cron.service';
import { DiscountsModule } from '../discounts/discounts.module';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { MockPaymentGatewayService } from '../payments/gateways/mock-payment-gateway.service';
import { StripePaymentGatewayService } from '../payments/gateways/stripe-payment-gateway.service';
import { PaymentGatewayService } from '../payments/gateways/payment-gateway.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DiscountsModule,NotificationsModule],
  controllers: [PackagesController],
  providers: [PackagesService, PackagesCronService, DomainEventBus,
    MockPaymentGatewayService,
    StripePaymentGatewayService,
    {
      provide: PaymentGatewayService,
      useFactory: (stripe: StripePaymentGatewayService, mock: MockPaymentGatewayService) =>
        stripe.isAvailable ? stripe : mock,
      inject: [StripePaymentGatewayService, MockPaymentGatewayService],
    },
  ],
  exports: [PackagesService],
})
export class PackagesModule {}
