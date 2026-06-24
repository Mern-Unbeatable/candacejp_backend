-- CreateEnum
CREATE TYPE "CustomTravelRequestStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'CONFIRMED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CustomTravelRequest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tripType" "TripType" NOT NULL,
    "direction" "Direction" NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "returnDirection" "Direction",
    "returnOrigin" TEXT,
    "returnDestination" TEXT,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),
    "passengerCount" INTEGER NOT NULL,
    "specialRequests" TEXT,
    "status" "CustomTravelRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTravelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomTravelPassenger" (
    "id" TEXT NOT NULL,
    "customTravelRequestId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "address" TEXT,
    "zipCode" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTravelPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomTravelRequest_memberId_idx" ON "CustomTravelRequest"("memberId");

-- CreateIndex
CREATE INDEX "CustomTravelRequest_status_idx" ON "CustomTravelRequest"("status");

-- CreateIndex
CREATE INDEX "CustomTravelRequest_departureDate_idx" ON "CustomTravelRequest"("departureDate");

-- CreateIndex
CREATE INDEX "CustomTravelPassenger_customTravelRequestId_idx" ON "CustomTravelPassenger"("customTravelRequestId");

-- AddForeignKey
ALTER TABLE "CustomTravelRequest" ADD CONSTRAINT "CustomTravelRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTravelPassenger" ADD CONSTRAINT "CustomTravelPassenger_customTravelRequestId_fkey" FOREIGN KEY ("customTravelRequestId") REFERENCES "CustomTravelRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
