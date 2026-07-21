import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoritesQueryDto } from './dto/favorites-query.dto';
import { FavoriteTargetType } from '@prisma/client';

/**
 * FavoritesService (docs/favorites-implementation-plan.md)
 *
 * One table, one `targetType` discriminator — mirrors the
 * `ChangeRequestTargetType` convention already in the schema, rather than a
 * separate table per target.
 */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertValidTarget(targetType: FavoriteTargetType, targetId: string) {
    if (targetType === FavoriteTargetType.SERVICE) {
      const service = await this.prisma.service.findUnique({ where: { id: targetId } });
      if (!service || service.approvalStatus !== 'ACTIVE' || service.isPackaged) {
        throw new BadRequestException(
          service?.isPackaged
            ? 'A package-exclusive service cannot be favorited directly — favorite the package it belongs to instead'
            : 'Service not found or not active',
        );
      }
    } else if (targetType === FavoriteTargetType.PROVIDER) {
      const provider = await this.prisma.serviceProvider.findUnique({ where: { id: targetId } });
      if (!provider || provider.approvalStatus !== 'APPROVED') {
        throw new BadRequestException('Provider not found or not approved');
      }
    } else {
      const pkg = await this.prisma.package.findUnique({ where: { id: targetId } });
      if (!pkg || pkg.status !== 'ACTIVE') {
        throw new BadRequestException('Package not found or not active');
      }
    }
  }

  async create(userId: string, dto: CreateFavoriteDto) {
    await this.assertValidTarget(dto.targetType, dto.targetId);

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_targetType_targetId: { userId, targetType: dto.targetType, targetId: dto.targetId } },
    });
    if (existing) throw new ConflictException('Already favorited');

    const favorite = await this.prisma.favorite.create({
      data: { userId, targetType: dto.targetType, targetId: dto.targetId },
    });

    return { message: 'Added to favorites', data: favorite };
  }

  async remove(userId: string, targetType: FavoriteTargetType, targetId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });
    if (!existing) throw new NotFoundException('Favorite not found');

    await this.prisma.favorite.delete({ where: { id: existing.id } });
    return { message: 'Removed from favorites', data: null };
  }

  async status(userId: string, targetType: FavoriteTargetType, targetId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });
    return { message: 'Favorite status retrieved', data: { isFavorited: !!existing } };
  }

  /**
   * Resolved live at read time, always — a favorite is a pointer, not a
   * cached copy (docs §3). A target that no longer resolves (deleted, not
   * just deactivated) is skipped rather than erroring the whole list.
   */
  async list(userId: string, query: FavoritesQueryDto) {
    const { page = 1, limit = 10, targetType } = query;
    const skip = (page - 1) * limit;

    const where = { userId, ...(targetType && { targetType }) };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.favorite.count({ where }),
    ]);

    const items = (
      await Promise.all(
        rows.map(async (row) => {
          const target = await this.resolveTarget(row.targetType, row.targetId);
          if (!target) return null;
          return { ...row, target };
        }),
      )
    ).filter(Boolean);

    return {
      message: 'Favorites retrieved successfully',
      data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    };
  }

  private async resolveTarget(targetType: FavoriteTargetType, targetId: string) {
    if (targetType === FavoriteTargetType.SERVICE) {
      return this.prisma.service.findUnique({
        where: { id: targetId },
        select: { id: true, description: true, price: true, rating: true, serviceLogo: true, approvalStatus: true },
      });
    }
    if (targetType === FavoriteTargetType.PROVIDER) {
      return this.prisma.serviceProvider.findUnique({
        where: { id: targetId },
        select: { id: true, businessName: true, description: true },
      });
    }
    return this.prisma.package.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, description: true, status: true },
    });
  }
}
