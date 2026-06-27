-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'SEEN');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "status" "MessageStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "Message" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "seenAt" TIMESTAMP(3);

-- Update existing rows: isRead true -> SEEN
UPDATE "Message" SET "status" = 'SEEN', "seenAt" = "createdAt" WHERE "isRead" = true;

-- CreateIndex
CREATE INDEX "Message_receiverId_status_idx" ON "Message"("receiverId", "status");
