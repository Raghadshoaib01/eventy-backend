/*
  Warnings:

  - The values [ACTIVE] on the enum `EventStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CARD] on the enum `PaymentMethod` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EventStatus_new" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Event" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Event" ALTER COLUMN "status" TYPE "EventStatus_new" USING ("status"::text::"EventStatus_new");
ALTER TYPE "EventStatus" RENAME TO "EventStatus_old";
ALTER TYPE "EventStatus_new" RENAME TO "EventStatus";
DROP TYPE "EventStatus_old";
ALTER TABLE "Event" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('CASH', 'BANK_TRANSFER');
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING ("method"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";
COMMIT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "discountAmount" DOUBLE PRECISION,
ADD COLUMN     "discountId" TEXT;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
