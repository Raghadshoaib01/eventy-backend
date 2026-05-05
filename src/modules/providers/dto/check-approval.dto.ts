import { ApprovalStatus } from '@prisma/client';

export class CheckApprovalResponseDto {
  approvalStatus: ApprovalStatus; // PENDING | APPROVED | REJECTED
  message: string;
  canAccessDashboard: boolean;
}
