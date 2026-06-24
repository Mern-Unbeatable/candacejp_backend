/*
  Warnings:

  - You are about to drop the column `status` on the `CustomTravelRequest` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CustomTravelRequest_status_idx";

-- AlterTable
ALTER TABLE "CustomTravelRequest" DROP COLUMN "status";

-- DropEnum
DROP TYPE "CustomTravelRequestStatus";
