/*
  Warnings:

  - Added the required column `publicId` to the `ServiceDetailFile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ServiceAvailability" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ServiceDetailFile" ADD COLUMN     "publicId" TEXT NOT NULL;
