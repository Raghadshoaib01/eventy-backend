-- AlterTable
ALTER TABLE "BlockedSlot" ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "serviceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "BlockedSlot_groupId_idx" ON "BlockedSlot"("groupId");
