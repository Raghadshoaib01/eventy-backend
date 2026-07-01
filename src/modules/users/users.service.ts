import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { JwtPayload } from 'src/common/helpers/token.helper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // GET /users/:id?
  // Admin: id required -> returns that user's profile.
  // Non-admin: id ignored -> returns the caller's own profile.
  // ─────────────────────────────────────────────────────────────
  async getProfile(caller: JwtPayload, id?: string) {
    let targetId: string;

    if (caller.role === 'ADMIN') {
      if (!id) {
        throw new BadRequestException('id is required when requesting a user profile as admin');
      }
      targetId = id;
    } else {
      targetId = caller.sub;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profileImage: true,
        locationName: true,
        latitude: true,
        longitude: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        customer: { select: { loyaltyPoints: true } },
        provider: {
          select: { id: true, businessName: true, approvalStatus: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      message: 'User profile retrieved successfully',
      data: user,
    };
  }
}
