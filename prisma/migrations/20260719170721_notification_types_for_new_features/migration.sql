-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PACKAGE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PACKAGE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'PACKAGE_CHANGE_APPLIED';
ALTER TYPE "NotificationType" ADD VALUE 'PACKAGE_SERVICE_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'DISCOUNT_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_REPLIED';
ALTER TYPE "NotificationType" ADD VALUE 'COMPLAINT_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'COMPLAINT_REPLIED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERY_OUT_FOR_DELIVERY';
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERY_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERY_FAILED';
