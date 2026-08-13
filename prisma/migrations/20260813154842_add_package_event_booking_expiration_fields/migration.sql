-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PACKAGE_JOIN_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'PACKAGE_BOOKING_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'PACKAGE_PAYMENT_EXPIRED';

-- AlterTable
ALTER TABLE "PackageEventBooking" ADD COLUMN     "paymentExpiresAt" TIMESTAMP(3),
ADD COLUMN     "pendingExpiresAt" TIMESTAMP(3);
