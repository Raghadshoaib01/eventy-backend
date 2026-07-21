import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { Discount, DiscountOrigin, DiscountScope, DiscountStatus } from '@prisma/client';

/**
 * DiscountsService (docs/discounts-implementation-plan.md)
 *
 * No approval workflow in the current scope — a package can only contain its
 * own provider's services (docs/packages-implementation-plan.md §2.3), so a
 * PROVIDER-origin discount never affects another provider's payout and
 * always self-activates. `ADMIN_PACKAGE`-origin multi-provider approval is
 * explicitly deferred to whenever multi-provider admin packages exist (§1).
 */
@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  // ── shared validation ────────────────────────────────────────

  private async resolveOwnedTarget(userId: string, dto: CreateDiscountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { provider: true } });
    if (!user || !user.provider) throw new NotFoundException('Provider not found');

    if (dto.scope === DiscountScope.SERVICE) {
      if (!dto.serviceId || dto.packageId) {
        throw new BadRequestException('scope=SERVICE requires serviceId only (docs §2)');
      }
      const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      if (!service) throw new NotFoundException('Service not found');
      if (service.providerId !== user.provider.id) throw new ForbiddenException('Access denied');
    } else {
      if (!dto.packageId || dto.serviceId) {
        throw new BadRequestException('scope=PACKAGE requires packageId only (docs §2)');
      }
      const pkg = await this.prisma.package.findUnique({ where: { id: dto.packageId } });
      if (!pkg) throw new NotFoundException('Package not found');
      if (pkg.providerId !== user.provider.id) throw new ForbiddenException('Access denied');
    }

    return user.provider;
  }

  private async assertNoActiveDiscount(serviceId?: string, packageId?: string) {
    // One active discount per target at a time (docs §4/§8) — stacking is future work.
    const existing = await this.prisma.discount.findFirst({
      where: { serviceId, packageId, status: DiscountStatus.ACTIVE },
    });
    if (existing) {
      throw new BadRequestException('This service/package already has an active discount');
    }
  }

  // ── provider ─────────────────────────────────────────────────

  async createProviderDiscount(userId: string, dto: CreateDiscountDto) {
    await this.resolveOwnedTarget(userId, dto);
    await this.assertNoActiveDiscount(dto.serviceId, dto.packageId);

    if (dto.code) {
      const codeTaken = await this.prisma.discount.findUnique({ where: { code: dto.code } });
      if (codeTaken) throw new BadRequestException('This discount code is already in use');
    }

    // Always self-activates — a provider discounting their own service or
    // their own (always single-provider) package affects only their own
    // payout, so there is no one else who needs to approve it (docs §1).
    const discount = await this.prisma.discount.create({
      data: {
        scope: dto.scope,
        serviceId: dto.serviceId,
        packageId: dto.packageId,
        origin: DiscountOrigin.PROVIDER,
        code: dto.code,
        percentOff: dto.percentOff,
        status: DiscountStatus.ACTIVE,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        createdByUserId: userId,
      },
    });

    return { message: 'Discount created and active', data: discount };
  }

  async listMyDiscounts(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { provider: true } });
    if (!user || !user.provider) throw new NotFoundException('Provider not found');

    const discounts = await this.prisma.discount.findMany({
      where: {
        OR: [
          { service: { providerId: user.provider.id } },
          { package: { providerId: user.provider.id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return { message: 'Discounts retrieved successfully', data: discounts };
  }

  /** Re-confirm a discount suspended by a package composition change (docs §3). */
  async reconfirm(userId: string, discountId: string) {
    const discount = await this.getOwnedDiscount(userId, discountId);

    if (!discount.needsReconfirmation) {
      throw new BadRequestException('This discount does not need reconfirmation');
    }

    const updated = await this.prisma.discount.update({
      where: { id: discountId },
      data: { needsReconfirmation: false },
    });

    return { message: 'Discount reconfirmed and active again', data: updated };
  }

  async cancelByProvider(userId: string, discountId: string) {
    await this.getOwnedDiscount(userId, discountId);
    return this.cancel(discountId, userId);
  }

  private async getOwnedDiscount(userId: string, discountId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { provider: true } });
    if (!user || !user.provider) throw new NotFoundException('Provider not found');

    const discount = await this.prisma.discount.findUnique({
      where: { id: discountId },
      include: { service: true, package: true },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    const ownsTarget =
      discount.service?.providerId === user.provider.id || discount.package?.providerId === user.provider.id;
    if (!ownsTarget) throw new ForbiddenException('Access denied');

    return discount;
  }

  // ── admin ────────────────────────────────────────────────────

  async createCompanyFundedDiscount(adminId: string, dto: CreateDiscountDto) {
    if (dto.scope === DiscountScope.SERVICE && (!dto.serviceId || dto.packageId)) {
      throw new BadRequestException('scope=SERVICE requires serviceId only (docs §2)');
    }
    if (dto.scope === DiscountScope.PACKAGE && (!dto.packageId || dto.serviceId)) {
      throw new BadRequestException('scope=PACKAGE requires packageId only (docs §2)');
    }
    await this.assertNoActiveDiscount(dto.serviceId, dto.packageId);

    // Company absorbs the cost — no provider payout is reduced, so no
    // approval is needed regardless of who owns the target (docs §1).
    const discount = await this.prisma.discount.create({
      data: {
        scope: dto.scope,
        serviceId: dto.serviceId,
        packageId: dto.packageId,
        origin: DiscountOrigin.COMPANY_FUNDED,
        code: dto.code,
        percentOff: dto.percentOff,
        status: DiscountStatus.ACTIVE,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        createdByUserId: adminId,
      },
    });

    return { message: 'Company-funded discount created and active', data: discount };
  }

  async cancelByAdmin(discountId: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id: discountId } });
    if (!discount) throw new NotFoundException('Discount not found');
    return this.cancel(discountId, discount.createdByUserId);
  }

  private async cancel(discountId: string, actorId: string) {
    const discount = await this.prisma.discount.update({
      where: { id: discountId },
      data: { status: DiscountStatus.CANCELLED },
    });

    // Only notify if someone other than the creator did the cancelling —
    // a provider cancelling their own discount doesn't need to be told
    // about their own action (docs §7).
    if (actorId !== discount.createdByUserId) {
      this.domainEventBus.discountCancelled({
        actorId,
        targetUserId: discount.createdByUserId,
        entityId: discount.id,
        discountId: discount.id,
      });
    }

    return { message: 'Discount cancelled', data: discount };
  }

  // ── redemption helpers, used by Packages/Payments (docs §5) ────

  private isCurrentlyValid(discount: Discount) {
    const now = new Date();
    if (discount.status !== DiscountStatus.ACTIVE || discount.needsReconfirmation) return false;
    if (discount.startsAt && discount.startsAt > now) return false;
    if (discount.endsAt && discount.endsAt < now) return false;
    return true;
  }

  /**
   * Resolves the discount that applies to a package purchase, if any.
   * Auto-applied (code = null) discounts are used automatically; a
   * code-bearing one only applies if the caller supplied a matching code.
   * Never combined with a component service's own discount (docs §4).
   */
  async resolveActiveDiscountForPackage(packageId: string, suppliedCode?: string): Promise<Discount | null> {
    const discount = await this.prisma.discount.findFirst({
      where: { scope: DiscountScope.PACKAGE, packageId, status: DiscountStatus.ACTIVE },
    });
    return this.matchOrNull(discount, suppliedCode);
  }

  async resolveActiveDiscountForService(serviceId: string, suppliedCode?: string): Promise<Discount | null> {
    const discount = await this.prisma.discount.findFirst({
      where: { scope: DiscountScope.SERVICE, serviceId, status: DiscountStatus.ACTIVE },
    });
    return this.matchOrNull(discount, suppliedCode);
  }

  private matchOrNull(discount: Discount | null, suppliedCode?: string): Discount | null {
    if (!discount || !this.isCurrentlyValid(discount)) {
      if (suppliedCode) throw new BadRequestException('Invalid or expired discount code');
      return null;
    }
    if (discount.code) {
      if (!suppliedCode || suppliedCode !== discount.code) {
        if (suppliedCode) throw new BadRequestException('Invalid or expired discount code');
        return null; // code-required discount, none supplied — simply don't apply
      }
    }
    return discount;
  }

  /**
   * Called by PackagesService whenever a package's non-Hall composition
   * changes (docs §3) — an active discount is suspended, not deleted, until
   * the (sole) provider re-confirms it still applies to the new line-up.
   */
  async suspendDiscountsForPackage(packageId: string) {
    await this.prisma.discount.updateMany({
      where: { packageId, status: DiscountStatus.ACTIVE },
      data: { needsReconfirmation: true },
    });
  }
}
