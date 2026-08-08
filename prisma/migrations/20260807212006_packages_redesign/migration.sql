/*
  Warnings:

  - The values [PACKAGE_APPROVED,PACKAGE_REJECTED,PACKAGE_CHANGE_APPLIED,PACKAGE_SERVICE_REMOVED] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING_APPROVAL,REJECTED,INACTIVE] on the enum `PackageStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `packageBookingId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `packageBookingId` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `pricingStrategy` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `reviewNote` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedAt` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedById` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `packageId` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the `PackageBooking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PackageBookingItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PackageChangeRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PackageItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[packageEventBookingId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PackageServiceStatus" AS ENUM ('PENDING_PROVIDER_APPROVAL', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "PackageEventBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SuggestedPackageStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('OTP_SENT', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'ACCOUNT_BLOCKED', 'ACCOUNT_UNBLOCKED', 'ACCOUNT_VERIFIED', 'LOGIN_ALERT', 'ADMIN_NEW_PROVIDER_REQUEST', 'BOOKING_CREATED', 'BOOKING_QUOTE_SENT', 'BOOKING_QUOTE_CONFIRMED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED', 'PROVIDER_APPROVED', 'PROVIDER_REJECTED', 'PROVIDER_REGISTERED', 'SERVICE_APPROVED', 'SERVICE_REJECTED', 'PAYMENT_CONFIRMED', 'EVENT_CANCELLED', 'GENERAL', 'PACKAGE_JOIN_REQUESTED', 'PACKAGE_ACTIVATED', 'PACKAGE_JOIN_ACCEPTED', 'PACKAGE_JOIN_REJECTED', 'PACKAGE_PARTNER_LEFT', 'PACKAGE_BOOKING_REQUESTED', 'PACKAGE_BOOKING_ACCEPTED', 'PACKAGE_BOOKING_REJECTED', 'PACKAGE_PAYMENT_CASH_CHOSEN', 'PACKAGE_PAYMENT_CONFIRMED', 'PACKAGE_BOOKING_PAYMENT_EXPIRED', 'DISCOUNT_CANCELLED', 'REVIEW_REPLIED', 'COMPLAINT_STATUS_CHANGED', 'COMPLAINT_REPLIED', 'PAYMENT_FAILED', 'DELIVERY_OUT_FOR_DELIVERY', 'DELIVERY_COMPLETED', 'DELIVERY_FAILED');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PackageStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'CANCELLED');
ALTER TABLE "Package" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Package" ALTER COLUMN "status" TYPE "PackageStatus_new" USING ("status"::text::"PackageStatus_new");
ALTER TYPE "PackageStatus" RENAME TO "PackageStatus_old";
ALTER TYPE "PackageStatus_new" RENAME TO "PackageStatus";
DROP TYPE "PackageStatus_old";
ALTER TABLE "Package" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_packageBookingId_fkey";

-- DropForeignKey
ALTER TABLE "PackageBooking" DROP CONSTRAINT "PackageBooking_customerId_fkey";

-- DropForeignKey
ALTER TABLE "PackageBooking" DROP CONSTRAINT "PackageBooking_eventId_fkey";

-- DropForeignKey
ALTER TABLE "PackageBooking" DROP CONSTRAINT "PackageBooking_packageId_fkey";

-- DropForeignKey
ALTER TABLE "PackageBookingItem" DROP CONSTRAINT "PackageBookingItem_packageBookingId_fkey";

-- DropForeignKey
ALTER TABLE "PackageChangeRequest" DROP CONSTRAINT "PackageChangeRequest_packageId_fkey";

-- DropForeignKey
ALTER TABLE "PackageItem" DROP CONSTRAINT "PackageItem_packageId_fkey";

-- DropForeignKey
ALTER TABLE "PackageItem" DROP CONSTRAINT "PackageItem_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_packageId_fkey";

-- DropIndex
DROP INDEX "Booking_packageBookingId_idx";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "packageBookingId",
ADD COLUMN     "packageEventBookingId" TEXT;

-- AlterTable
ALTER TABLE "Complaint" DROP COLUMN "packageBookingId",
ADD COLUMN     "packageEventBookingId" TEXT;

-- AlterTable
ALTER TABLE "Package" DROP COLUMN "pricingStrategy",
DROP COLUMN "reviewNote",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedById",
ADD COLUMN     "discountPercentage" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "packageEventBookingId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "packageId";

-- DropTable
DROP TABLE "PackageBooking";

-- DropTable
DROP TABLE "PackageBookingItem";

-- DropTable
DROP TABLE "PackageChangeRequest";

-- DropTable
DROP TABLE "PackageItem";

-- DropEnum
DROP TYPE "PackageBookingStatus";

-- DropEnum
DROP TYPE "PackageChangeStatus";

-- DropEnum
DROP TYPE "PackagePricingStrategy";

-- CreateTable
CREATE TABLE "PackageService" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "PackageServiceStatus" NOT NULL DEFAULT 'PENDING_PROVIDER_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageEventBooking" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "eventId" TEXT,
    "status" "PackageEventBookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageEventBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SuggestedPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestedPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ServiceToSuggestedPackage" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageService_packageId_serviceId_key" ON "PackageService"("packageId", "serviceId");

-- CreateIndex
CREATE INDEX "PackageEventBooking_packageId_idx" ON "PackageEventBooking"("packageId");

-- CreateIndex
CREATE INDEX "PackageEventBooking_customerId_idx" ON "PackageEventBooking"("customerId");

-- CreateIndex
CREATE INDEX "PackageEventBooking_status_idx" ON "PackageEventBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "_ServiceToSuggestedPackage_AB_unique" ON "_ServiceToSuggestedPackage"("A", "B");

-- CreateIndex
CREATE INDEX "_ServiceToSuggestedPackage_B_index" ON "_ServiceToSuggestedPackage"("B");

-- CreateIndex
CREATE INDEX "Booking_packageEventBookingId_idx" ON "Booking"("packageEventBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_packageEventBookingId_key" ON "Payment"("packageEventBookingId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageEventBookingId_fkey" FOREIGN KEY ("packageEventBookingId") REFERENCES "PackageEventBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageService" ADD CONSTRAINT "PackageService_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageService" ADD CONSTRAINT "PackageService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageService" ADD CONSTRAINT "PackageService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageEventBooking" ADD CONSTRAINT "PackageEventBooking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageEventBooking" ADD CONSTRAINT "PackageEventBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageEventBooking" ADD CONSTRAINT "PackageEventBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_packageEventBookingId_fkey" FOREIGN KEY ("packageEventBookingId") REFERENCES "PackageEventBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceToSuggestedPackage" ADD CONSTRAINT "_ServiceToSuggestedPackage_A_fkey" FOREIGN KEY ("A") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceToSuggestedPackage" ADD CONSTRAINT "_ServiceToSuggestedPackage_B_fkey" FOREIGN KEY ("B") REFERENCES "SuggestedPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
