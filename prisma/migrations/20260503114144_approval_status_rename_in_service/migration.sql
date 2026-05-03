/*
  Warnings:

  - You are about to drop the column `status` on the `Service` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Service" DROP COLUMN "status",
ADD COLUMN     "approvalStatus" "ServiceStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';
