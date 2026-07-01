-- CreateEnum
CREATE TYPE "ChangeRequestTargetType" AS ENUM ('SERVICE', 'SUB_SERVICE');

-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('CREATE', 'UPDATE');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubService" DROP COLUMN "isAutoCreated",
ADD COLUMN     "approvalStatus" "ServiceStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';

-- CreateTable
CREATE TABLE "ServiceChangeRequest" (
    "id" TEXT NOT NULL,
    "targetType" "ChangeRequestTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestType" "ChangeRequestType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceChangeRequest_targetType_targetId_idx" ON "ServiceChangeRequest"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ServiceChangeRequest_status_idx" ON "ServiceChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "ServiceChangeRequest" ADD CONSTRAINT "ServiceChangeRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

