import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { DiscountsService } from '../discounts/discounts.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PayPackageBookingDto } from './dto/pay-package-booking.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentGatewayService } from './gateways/payment-gateway.service';
import { PaymentMethod, PaymentStatus, Payment, Booking } from '@prisma/client';

/**
 * PaymentsService (docs/payments-implementation-plan.md)
 *
 * One Payment per Booking, always — including a package purchase's child
 * bookings (§4, §11 of packages-implementation-plan.md). There is
 * deliberately no separate "package payment" object.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
    private readonly bookingsService: BookingsService,
    private readonly packagesService: PackagesService,
    private readonly discountsService: DiscountsService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  // ── customer ─────────────────────────────────────────────────

  async createPayment(userId: string, dto: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== userId) throw new ForbiddenException('Access denied');

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Booking must be CONFIRMED before payment (current status: ${booking.status})`,
      );
    }

    const result = await this.createPaymentForBooking(userId, booking, dto.method, dto.discountCode);
    return result;
  }

  /**
   * Shared per-booking payment creation — used both by the standalone
   * POST /payments endpoint and by the package batch-payment endpoint below,
   * since a package purchase is just several of these created together
   * (docs/packages-implementation-plan.md §12.4), not a different mechanism.
   *
   * A package-sourced booking (`packageBookingId` set) never resolves a
   * SERVICE-scope discount here — its price was already finalized, net of
   * the package's own discount, at booking time (no stacking, docs
   * /discounts-implementation-plan.md §4/§5).
   */
  private async createPaymentForBooking(payerId: string, booking: Booking, method: PaymentMethod, discountCode?: string) {
    // Double-payment guard (docs §9): return the existing row instead of
    // erroring unhelpfully if one already exists for this booking.
    const existing = await this.prisma.payment.findUnique({ where: { bookingId: booking.id } });
    if (existing) {
      return { message: 'Payment already exists for this booking', data: existing };
    }

    const subtotalAmount = booking.finalAmount ?? booking.totalAmount;

    let discountId: string | undefined;
    let discountAmount: number | undefined;
    let amount = subtotalAmount;

    if (!booking.packageBookingId) {
      const discount = await this.discountsService.resolveActiveDiscountForService(booking.serviceId, discountCode);
      if (discount) {
        discountId = discount.id;
        discountAmount = subtotalAmount * (discount.percentOff / 100);
        amount = subtotalAmount - discountAmount;
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        payerId,
        amount,
        subtotalAmount,
        discountId,
        discountAmount,
        method,
        status: PaymentStatus.PENDING,
      },
    });

    if (method === PaymentMethod.CASH) {
      // Provider confirms manually later (docs §1, §3) — nothing more to do now.
      return { message: 'Cash payment recorded — awaiting provider confirmation', data: payment };
    }

    return this.processElectronicPayment(payment);
  }

  /**
   * POST /packages/:packageBookingId/payments (docs §12.4) — one customer
   * action creates and processes one Payment per child Booking under the
   * PackageBooking, in one batch. Never one aggregated payment.
   */
  async payForPackageBooking(userId: string, packageBookingId: string, dto: PayPackageBookingDto) {
    const pb = await this.prisma.packageBooking.findUnique({
      where: { id: packageBookingId },
      include: { bookings: true },
    });
    if (!pb) throw new NotFoundException('Package booking not found');
    if (pb.customerId !== userId) throw new ForbiddenException('Access denied');
    if (pb.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(`Package booking cannot be paid while it is ${pb.status}`);
    }

    const results = await Promise.all(
      pb.bookings.map((booking) => this.createPaymentForBooking(userId, booking, dto.method)),
    );

    return {
      message: 'Payment processed for every service in the package',
      data: results.map((r) => r.data),
    };
  }

  private async processElectronicPayment(payment: Payment) {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PROCESSING },
    });

    const result = await this.gateway.charge(payment);

    if (result.success) {
      const paid = await this.markPaid(payment.id, result.providerReference);
      return { message: 'Payment confirmed', data: paid };
    }

    const failed = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });

    const booking = await this.prisma.booking.findUnique({ where: { id: payment.bookingId } });
    if (booking) {
      this.domainEventBus.paymentFailed({
        actorId: payment.payerId,
        targetUserId: payment.payerId,
        entityId: payment.id,
        bookingId: booking.id,
        amount: payment.amount,
        failureReason: result.failureReason,
      });
    }

    return { message: 'Payment failed', data: failed };
  }

  async getPayment(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { provider: { include: { user: true } } } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const isPayer = payment.payerId === userId;
    const isProvider = payment.booking.provider.user.id === userId;
    if (!isPayer && !isProvider) throw new ForbiddenException('Access denied');

    return { message: 'Payment retrieved successfully', data: payment };
  }

  // ── provider ─────────────────────────────────────────────────

  async markCashPaid(userId: string, paymentId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { provider: true } });
    if (!user || !user.provider) throw new NotFoundException('Provider not found');

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.booking.providerId !== user.provider.id) {
      throw new ForbiddenException('Access denied');
    }
    if (payment.method !== PaymentMethod.CASH) {
      throw new BadRequestException('Only cash payments can be confirmed this way');
    }
    if (payment.status !== PaymentStatus.PROCESSING) {
      throw new BadRequestException(`Payment cannot be confirmed while it is ${payment.status}`);
    }

    const paid = await this.markPaid(payment.id);
    return { message: 'Cash payment confirmed', data: paid };
  }

  // ── shared: what happens once a payment clears, regardless of method ──

  private async markPaid(paymentId: string, providerReference?: string) {
    const paid = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, paidAt: new Date(), providerReference },
    });

    const booking = await this.prisma.booking.findUnique({
      where: { id: paid.bookingId },
      include: { provider: { include: { user: true } } },
    });
    if (!booking) return paid;

    // Notify both the customer and the provider (docs §8) — same event,
    // emitted twice with a different recipient each time.
    this.domainEventBus.paymentConfirmed({
      actorId: paid.payerId,
      targetUserId: paid.payerId,
      entityId: paid.id,
      bookingId: booking.id,
      amount: paid.amount,
    });
    this.domainEventBus.paymentConfirmed({
      actorId: paid.payerId,
      targetUserId: booking.provider.user.id,
      entityId: paid.id,
      bookingId: booking.id,
      amount: paid.amount,
    });

    // Payment is a real gate on progression (docs §4, §7) — re-evaluate
    // whether the booking can now move to IN_PROGRESS. A package-sourced
    // booking progresses with its PackageBooking siblings, not with
    // whatever else happens to share its (optional) eventId — those are two
    // different "wait for everyone" groups (docs/packages-implementation-plan.md §12.4).
    if (booking.packageBookingId) {
      await this.packagesService.tryProgressPackageBooking(booking.packageBookingId);
    }
     else if (booking.eventId) {
      await this.bookingsService.tryProgressEvent(booking.eventId);
    }

    return paid;
  }

  // ── admin ────────────────────────────────────────────────────

  async listPayments(query: { page?: number; limit?: number; status?: PaymentStatus; method?: PaymentMethod }) {
    // page/limit arrive as NaN (not undefined) when the query param is
    // absent — Nest's global ValidationPipe({transform:true}) coerces a
    // bare `@Query('page') page?: number` via `Number(undefined)` before
    // this runs, so `= default` destructuring never fires. `|| default`
    // catches NaN. (Same bug found and fixed in AdminApprovalService.listPendingPackages.)
    const page = query.page || 1;
    const limit = query.limit || 10;
    const { status, method } = query;
    const skip = (page - 1) * limit;

    const where = { ...(status && { status }), ...(method && { method }) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      message: 'Payments retrieved successfully',
      data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    };
  }

  async refundPayment(paymentId: string, dto: RefundPaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException(`Only a PAID payment can be refunded (current status: ${payment.status})`);
    }

    // Manual, simple, no automated reversal logic — a deliberate scope
    // decision for this build, not an oversight (docs §5).
    const refunded = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED },
    });

    return { message: 'Payment refunded successfully', data: { ...refunded, reason: dto.reason ?? null } };
  }
}
