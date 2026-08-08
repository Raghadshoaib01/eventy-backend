import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { DomainEventBus } from 'src/common/events/domain-event-bus';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { ReplyComplaintDto } from './dto/reply-complaint.dto';
import { ComplaintsQueryDto } from './dto/complaints-query.dto';
import { ComplaintStatus } from '@prisma/client';

const VALID_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  PENDING: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.REJECTED],
  IN_PROGRESS: [ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED],
  RESOLVED: [],
  REJECTED: [],
};

/**
 * ComplaintsService (docs/complaints-implementation-plan.md)
 *
 * A structural cousin of ServiceChangeRequest (payload + status moderation
 * queue) but its own model — a complaint needs a reporter and an against-
 * party that ServiceChangeRequest doesn't carry (docs §2).
 */
@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  async create(userId: string, dto: CreateComplaintDto) {
    if (dto.targetType !== 'GENERAL' && !dto.targetId) {
      throw new BadRequestException('targetId is required unless targetType is GENERAL');
    }

    const complaint = await this.prisma.complaint.create({
      data: {
        complainantId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        bookingId: dto.bookingId,
        packageEventBookingId: dto.packageEventBookingId,
        subject: dto.subject,
        description: dto.description,
        status: ComplaintStatus.PENDING,
      },
    });

    return { message: 'Complaint filed successfully', data: complaint };
  }

  async listMine(userId: string, query: ComplaintsQueryDto) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;
    const where = { complainantId: userId, ...(status && { status }) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.complaint.count({ where }),
    ]);

    return {
      message: 'Complaints retrieved successfully',
      data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    };
  }

  async getMine(userId: string, complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('Complaint not found');
    if (complaint.complainantId !== userId) throw new ForbiddenException('Access denied');
    return { message: 'Complaint retrieved successfully', data: complaint };
  }

  // ── admin ────────────────────────────────────────────────────

  async listAll(query: ComplaintsQueryDto) {
    const { page = 1, limit = 10, status, targetType, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(targetType && { targetType }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { complainant: { select: { fullName: true, email: true } } },
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return {
      message: 'Complaints retrieved successfully',
      data: { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    };
  }

  async getForAdmin(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { complainant: { select: { fullName: true, email: true } } },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');
    return { message: 'Complaint retrieved successfully', data: complaint };
  }

  async updateStatus(adminId: string, complaintId: string, dto: UpdateComplaintStatusDto) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const allowed = VALID_TRANSITIONS[complaint.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Cannot move a complaint from ${complaint.status} to ${dto.status}`);
    }

    const isTerminal = dto.status === ComplaintStatus.RESOLVED || dto.status === ComplaintStatus.REJECTED;

    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: dto.status,
        handledByUserId: adminId,
        resolvedAt: isTerminal ? new Date() : undefined,
      },
    });

    this.domainEventBus.complaintStatusChanged({
      actorId: adminId,
      targetUserId: complaint.complainantId,
      entityId: complaint.id,
      complaintId: complaint.id,
      status: dto.status,
    });

    return { message: 'Complaint status updated', data: updated };
  }

  async reply(adminId: string, complaintId: string, dto: ReplyComplaintDto) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: { adminReply: dto.adminReply, handledByUserId: adminId },
    });

    this.domainEventBus.complaintReplied({
      actorId: adminId,
      targetUserId: complaint.complainantId,
      entityId: complaint.id,
      complaintId: complaint.id,
    });

    return { message: 'Reply posted', data: updated };
  }
}
