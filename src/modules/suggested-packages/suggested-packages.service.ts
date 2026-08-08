// src/modules/suggested-packages/suggested-packages.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateSuggestedPackageDto } from './dto/create-suggested-package.dto';
import { UpdateSuggestedPackageDto } from './dto/update-suggested-package.dto';

/**
 * SuggestedPackagesService (docs/implementation_plan.md §3 — Admin & Customer APIs).
 *
 * Admin-curated bundles displayed to customers for inspiration. They are
 * NOT bookable — they just point at a curated set of public services
 * customers can browse and book individually. The implicit m-n relation
 * `Service.suggestedPackages` (prisma/schema.prisma:825) is the storage.
 */
@Injectable()
export class SuggestedPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── admin ──────────────────────────────────────────────────────────

  async create(adminId: string, dto: CreateSuggestedPackageDto) {
    const serviceIds = [...new Set(dto.serviceIds)];

    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, isPackaged: false },
      select: { id: true },
    });

    if (services.length !== serviceIds.length) {
      const found = new Set(services.map((s) => s.id));
      const missing = serviceIds.filter((id) => !found.has(id));
      throw new BadRequestException(
        `Services not found or not bookable standalone: ${missing.join(', ')}`,
      );
    }

    const created = await this.prisma.suggestedPackage.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        services: { connect: serviceIds.map((id) => ({ id })) },
        // Optional audit trail: tag the admin that created it.
        // (No field for this on the model — stored in metadata-style comment only.)
        // createdByUserId: adminId,
      },
      include: { services: { include: { serviceType: { select: { name: true } } } } },
    });

    return { message: 'Suggested package created', data: created, createdBy: adminId };
  }

  async listAll() {
    const items = await this.prisma.suggestedPackage.findMany({
      orderBy: { createdAt: 'desc' },
      include: { services: { include: { serviceType: { select: { name: true } } } } },
    });
    return { message: 'Suggested packages retrieved', data: items };
  }

  async getById(id: string) {
    const item = await this.prisma.suggestedPackage.findUnique({
      where: { id },
      include: { services: { include: { serviceType: { select: { name: true } } } } },
    });
    if (!item) throw new NotFoundException('Suggested package not found');
    return { message: 'Suggested package retrieved', data: item };
  }

  async update(id: string, dto: UpdateSuggestedPackageDto) {
    const existing = await this.prisma.suggestedPackage.findUnique({
      where: { id },
      include: { services: { select: { id: true } } },
    });
    if (!existing) throw new NotFoundException('Suggested package not found');

    if (dto.serviceIds) {
      const serviceIds = [...new Set(dto.serviceIds)];
      const services = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, isPackaged: false },
        select: { id: true },
      });
      if (services.length !== serviceIds.length) {
        const found = new Set(services.map((s) => s.id));
        const missing = serviceIds.filter((id) => !found.has(id));
        throw new BadRequestException(
          `Services not found or not bookable standalone: ${missing.join(', ')}`,
        );
      }

      await this.prisma.suggestedPackage.update({
        where: { id },
        data: {
          services: { set: serviceIds.map((id) => ({ id })) },
        },
      });
    }

    const updated = await this.prisma.suggestedPackage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { services: { include: { serviceType: { select: { name: true } } } } },
    });

    return { message: 'Suggested package updated', data: updated };
  }

  async delete(id: string) {
    const existing = await this.prisma.suggestedPackage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Suggested package not found');
    await this.prisma.suggestedPackage.delete({ where: { id } });
    return { message: 'Suggested package deleted', data: { id } };
  }

  async deactivate(id: string) {
    const existing = await this.prisma.suggestedPackage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Suggested package not found');
    const updated = await this.prisma.suggestedPackage.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return { message: 'Suggested package deactivated', data: updated };
  }

  // ── customer ───────────────────────────────────────────────────────

  async listActive() {
    const items = await this.prisma.suggestedPackage.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        services: {
          include: {
            serviceType: { select: { name: true } },
            provider: {
              select: {
                businessName: true,
                user: {
                  select: { fullName: true, profileImage: true, locationName: true },
                },
              },
            },
          },
        },
      },
    });
    return { message: 'Suggested packages retrieved', data: items };
  }

  async getActiveById(id: string) {
    const item = await this.prisma.suggestedPackage.findFirst({
      where: { id, status: 'ACTIVE' },
      include: {
        services: {
          include: {
            serviceType: { select: { name: true } },
            provider: {
              select: {
                businessName: true,
                user: {
                  select: {
                    fullName: true,
                    profileImage: true,
                    locationName: true,
                    latitude: true,
                    longitude: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Suggested package not found');
    return { message: 'Suggested package retrieved', data: item };
  }
}
