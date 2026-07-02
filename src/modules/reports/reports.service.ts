import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

const WEEKDAY_NAMES = [
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
];

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // GET /reports/dashboard
  // ─────────────────────────────────────────────────────────────
  async getDashboardStats() {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(thisMonthStart);

    const [
      totalUsers,
      usersThisMonth,
      totalProviders,
      pendingProviders,
      revenueThisMonthRows,
      revenueLastMonthRows,
      totalEvents,
      eventsThisMonth,
      eventsByStatusRaw,
      bookingsByServiceTypeRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      this.prisma.user.count({
        where: { role: 'CUSTOMER', deletedAt: null, createdAt: { gte: thisMonthStart } },
      }),
      this.prisma.serviceProvider.count(),
      this.prisma.serviceProvider.count({ where: { approvalStatus: 'PENDING' } }),
      this.prisma.booking.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: thisMonthStart } },
        select: { finalAmount: true, totalAmount: true },
      }),
      this.prisma.booking.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: lastMonthStart, lt: lastMonthEnd } },
        select: { finalAmount: true, totalAmount: true },
      }),
      this.prisma.event.count({ where: { archivedAt: null } }),
      this.prisma.event.count({ where: { archivedAt: null, createdAt: { gte: thisMonthStart } } }),
      this.prisma.event.groupBy({ by: ['status'], _count: { _all: true }, where: { archivedAt: null } }),
      this.prisma.booking.findMany({
        select: { service: { select: { serviceType: { select: { name: true } } } } },
      }),
    ]);

    const revenueThisMonth = revenueThisMonthRows.reduce(
      (sum, b) => sum + (b.finalAmount ?? b.totalAmount),
      0,
    );
    const revenueLastMonth = revenueLastMonthRows.reduce(
      (sum, b) => sum + (b.finalAmount ?? b.totalAmount),
      0,
    );
    const revenueMoMPercent =
      revenueLastMonth > 0
        ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 1000) / 10
        : null;

    const eventsByStatus = eventsByStatusRaw.reduce(
      (acc, row) => ({ ...acc, [row.status]: row._count._all }),
      {} as Record<string, number>,
    );

    const revenueLast6Months = await this.getRevenueLastNMonths(6);

    const bookingsByServiceTypeCounts: Record<string, number> = {};
    for (const row of bookingsByServiceTypeRows) {
      const name = row.service?.serviceType?.name ?? 'UNKNOWN';
      bookingsByServiceTypeCounts[name] = (bookingsByServiceTypeCounts[name] ?? 0) + 1;
    }
    const totalBookingsForShare = bookingsByServiceTypeRows.length;
    const bookingsByServiceType = Object.entries(bookingsByServiceTypeCounts)
      .map(([serviceType, count]) => ({
        serviceType,
        count,
        percentage: pct(count, totalBookingsForShare),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      message: 'Dashboard stats retrieved successfully',
      data: {
        users: {
          total: totalUsers,
          registeredThisMonth: usersThisMonth,
          registeredThisMonthPercent: pct(usersThisMonth, totalUsers),
        },
        providers: {
          total: totalProviders,
          pending: pendingProviders,
        },
        revenue: {
          thisMonth: revenueThisMonth,
          lastMonth: revenueLastMonth,
          momPercent: revenueMoMPercent,
        },
        events: {
          total: totalEvents,
          thisMonth: eventsThisMonth,
          byStatus: eventsByStatus,
        },
        revenueLast6Months,
        bookingsByServiceType,
      },
    };
  }

  private async getRevenueLastNMonths(n: number) {
    const now = new Date();
    const months: { year: number; month: number; from: Date; to: Date }[] = [];

    for (let i = n - 1; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({ year: from.getFullYear(), month: from.getMonth() + 1, from, to });
    }

    const rows = await this.prisma.booking.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: months[0].from, lt: months[months.length - 1].to },
      },
      select: { completedAt: true, finalAmount: true, totalAmount: true },
    });

    return months.map(({ year, month, from, to }) => {
      const revenue = rows
        .filter((r) => r.completedAt! >= from && r.completedAt! < to)
        .reduce((sum, b) => sum + (b.finalAmount ?? b.totalAmount), 0);
      return { year, month, revenue };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // GET /reports/analytics
  // ─────────────────────────────────────────────────────────────
  async getAnalytics(query: AnalyticsQueryDto) {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthStart = startOfMonth(now);

    const [weekBookings, monthBookingsWithType, providerAgg, eventsByTypeRaw] = await Promise.all([
      this.prisma.booking.findMany({
        where: { createdAt: { gte: weekStart, lt: weekEnd } },
        select: { createdAt: true, status: true },
      }),
      this.prisma.booking.findMany({
        where: { createdAt: { gte: monthStart } },
        select: {
          providerId: true,
          service: { select: { serviceType: { select: { name: true } } } },
        },
      }),
      this.prisma.booking.groupBy({
        by: ['providerId'],
        _count: { _all: true },
        orderBy: { _count: { providerId: 'desc' } },
      }),
      this.prisma.event.groupBy({ by: ['eventType'], _count: { _all: true }, where: { archivedAt: null } }),
    ]);

    // ── Bookings this week ──────────────────────────────────────
    const weekByDay: Record<string, number> = Object.fromEntries(
      WEEKDAY_NAMES.map((d) => [d, 0]),
    );
    let confirmed = 0;
    let pending = 0;
    let cancelled = 0;
    for (const b of weekBookings) {
      weekByDay[WEEKDAY_NAMES[b.createdAt.getDay()]]++;
      if (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED') confirmed++;
      else if (b.status === 'PENDING' || b.status === 'QUOTE_SENT') pending++;
      else if (b.status === 'CANCELLED' || b.status === 'REJECTED') cancelled++;
    }

    // ── Most requested service this month by type ───────────────
    const serviceTypeCounts: Record<string, number> = {};
    for (const b of monthBookingsWithType) {
      const name = b.service?.serviceType?.name ?? 'UNKNOWN';
      serviceTypeCounts[name] = (serviceTypeCounts[name] ?? 0) + 1;
    }
    const mostRequestedServices = Object.entries(serviceTypeCounts)
      .map(([serviceType, count]) => ({ serviceType, count }))
      .sort((a, b) => b.count - a.count);

    // ── Top 5 providers (overall or scoped to a service type) ───
    let topProviderIds = providerAgg.map((p) => ({ providerId: p.providerId, count: p._count._all }));

    if (query.serviceType) {
      const scoped = await this.prisma.booking.groupBy({
        by: ['providerId'],
        where: { service: { serviceType: { name: query.serviceType.toUpperCase() } } },
        _count: { _all: true },
        orderBy: { _count: { providerId: 'desc' } },
      });
      topProviderIds = scoped.map((p) => ({ providerId: p.providerId, count: p._count._all }));
    }
    topProviderIds = topProviderIds.slice(0, 5);

    const providerDetails = await this.prisma.serviceProvider.findMany({
      where: { id: { in: topProviderIds.map((p) => p.providerId) } },
      select: {
        id: true,
        businessName: true,
        services: { select: { rating: true, totalReviews: true } },
      },
    });

    const revenueByProvider = await this.prisma.booking.groupBy({
      by: ['providerId'],
      where: { providerId: { in: topProviderIds.map((p) => p.providerId) }, status: 'COMPLETED' },
      _sum: { finalAmount: true, totalAmount: true },
    });

    const topProviders = topProviderIds
      .map(({ providerId, count }) => {
        const provider = providerDetails.find((p) => p.id === providerId);
        const revenueRow = revenueByProvider.find((r) => r.providerId === providerId);
        const totalReviews = provider?.services.reduce((s, sv) => s + sv.totalReviews, 0) ?? 0;
        const avgRating =
          totalReviews > 0
            ? (provider!.services.reduce((s, sv) => s + sv.rating * sv.totalReviews, 0) / totalReviews)
            : 0;
        return {
          providerId,
          businessName: provider?.businessName ?? 'Unknown',
          bookings: count,
          rating: Math.round(avgRating * 10) / 10,
          revenue: (revenueRow?._sum.finalAmount ?? revenueRow?._sum.totalAmount ?? 0),
        };
      })
      .sort((a, b) => b.bookings - a.bookings);

    // ── Events share by type ─────────────────────────────────────
    const totalEventsForShare = eventsByTypeRaw.reduce((s, r) => s + r._count._all, 0);
    const eventsByType = eventsByTypeRaw
      .map((r) => ({
        eventType: r.eventType,
        count: r._count._all,
        percentage: pct(r._count._all, totalEventsForShare),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      message: 'Analytics retrieved successfully',
      data: {
        bookingsThisWeek: {
          total: weekBookings.length,
          confirmed,
          pending,
          cancelled,
          byWeekday: weekByDay,
        },
        mostRequestedServices,
        topProviders,
        eventsByType,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GET /reports/activity
  // ─────────────────────────────────────────────────────────────
  async getRecentActivity(pagination: PaginationDto) {
    const { page = 1, limit = 20, order = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: order },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, role: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    const labels = await this.resolveEntityLabels(items);

    const enrichedItems = items.map((item) => ({
      id: item.id,
      action: item.action,
      entity: item.entity,
      entityId: item.entityId,
      entityLabel:
        item.entityId != null
          ? (labels.get(`${item.entity}:${item.entityId}`) ?? null)
          : null,
      performedBy: item.user
        ? { id: item.user.id, fullName: item.user.fullName, role: item.user.role }
        : { id: null, fullName: 'System', role: null },
      createdAt: item.createdAt,
    }));

    return {
      message: 'Recent activity retrieved successfully',
      data: {
        items: enrichedItems,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Batch-resolves entityId -> human-readable label per entity type.
  // One query per distinct entity type in the page (not per row),
  // so a 20-row page costs at most ~6 extra queries regardless of size.
  // ─────────────────────────────────────────────────────────────
  private async resolveEntityLabels(
    items: { entity: string; entityId: string | null }[],
  ): Promise<Map<string, string>> {
    const idsByEntity = new Map<string, Set<string>>();
    for (const item of items) {
      if (!item.entityId) continue;
      if (!idsByEntity.has(item.entity)) idsByEntity.set(item.entity, new Set());
      idsByEntity.get(item.entity)!.add(item.entityId);
    }

    const labels = new Map<string, string>();
    const setLabel = (entity: string, id: string, label: string) =>
      labels.set(`${entity}:${id}`, label);

    await Promise.all(
      Array.from(idsByEntity.entries()).map(async ([entity, idSet]) => {
        const ids = Array.from(idSet);

        switch (entity) {
          case 'User': {
            const rows = await this.prisma.user.findMany({
              where: { id: { in: ids } },
              select: { id: true, fullName: true },
            });
            rows.forEach((r) => setLabel(entity, r.id, r.fullName));
            break;
          }
          case 'ServiceProvider': {
            const rows = await this.prisma.serviceProvider.findMany({
              where: { id: { in: ids } },
              select: { id: true, businessName: true },
            });
            rows.forEach((r) => setLabel(entity, r.id, r.businessName));
            break;
          }
          case 'Event': {
            const rows = await this.prisma.event.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
            rows.forEach((r) => setLabel(entity, r.id, r.name));
            break;
          }
          case 'Service': {
            const rows = await this.prisma.service.findMany({
              where: { id: { in: ids } },
              select: {
                id: true,
                serviceType: { select: { name: true } },
                provider: { select: { businessName: true } },
              },
            });
            rows.forEach((r) =>
              setLabel(
                entity,
                r.id,
                `${r.serviceType?.name ?? 'Service'} — ${r.provider?.businessName ?? 'Unknown provider'}`,
              ),
            );
            break;
          }
          case 'SubService': {
            const rows = await this.prisma.subService.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
            rows.forEach((r) => setLabel(entity, r.id, r.name));
            break;
          }
          case 'Booking': {
            const rows = await this.prisma.booking.findMany({
              where: { id: { in: ids } },
              select: {
                id: true,
                service: { select: { serviceType: { select: { name: true } } } },
                customer: { select: { fullName: true } },
              },
            });
            rows.forEach((r) =>
              setLabel(
                entity,
                r.id,
                `${r.service?.serviceType?.name ?? 'Booking'} for ${r.customer?.fullName ?? 'Unknown customer'}`,
              ),
            );
            break;
          }
          // Unrecognized/future entity types simply get no label (entityLabel: null)
          // instead of throwing — keeps this feed resilient to new @Audit() usages.
        }
      }),
    );

    return labels;
  }
}
