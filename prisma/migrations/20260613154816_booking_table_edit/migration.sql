/*
  Warnings:

  - You are about to drop the column `eventDate` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `eventEndTime` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `eventLocation` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `eventName` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `eventStartTime` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `eventType` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `numberOfGuests` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "eventDate",
DROP COLUMN "eventEndTime",
DROP COLUMN "eventLocation",
DROP COLUMN "eventName",
DROP COLUMN "eventStartTime",
DROP COLUMN "eventType",
DROP COLUMN "numberOfGuests";
