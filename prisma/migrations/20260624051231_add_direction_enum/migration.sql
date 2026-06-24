/*
  Warnings:

  - Added the required column `direction` to the `Opportunity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `direction` to the `TravelPreference` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('NYC_TAMPA', 'TAMPA_NYC');

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "direction" "Direction" NOT NULL;

-- AlterTable
ALTER TABLE "TravelPreference" ADD COLUMN     "direction" "Direction" NOT NULL;

-- CreateIndex
CREATE INDEX "Opportunity_direction_idx" ON "Opportunity"("direction");

-- CreateIndex
CREATE INDEX "TravelPreference_direction_idx" ON "TravelPreference"("direction");
