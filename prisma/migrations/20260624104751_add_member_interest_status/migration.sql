-- CreateEnum
CREATE TYPE "MemberInterestStatus" AS ENUM ('INTERESTED', 'CONFIRMED');

-- AlterTable
ALTER TABLE "CustomTravelRequest" ADD COLUMN     "status" "MemberInterestStatus" NOT NULL DEFAULT 'INTERESTED';

-- CreateIndex
CREATE INDEX "CustomTravelRequest_direction_idx" ON "CustomTravelRequest"("direction");

-- CreateIndex
CREATE INDEX "CustomTravelRequest_status_idx" ON "CustomTravelRequest"("status");
