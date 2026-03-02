-- AlterTable
ALTER TABLE "UserNumberOrder"
ADD COLUMN "refundedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UserNumberOrder_userId_refundedAt_idx"
ON "UserNumberOrder"("userId", "refundedAt");
