-- AlterTable
ALTER TABLE "UserTopup"
ADD COLUMN "expiredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UserTopup_userId_status_expiredAt_idx"
ON "UserTopup"("userId", "status", "expiredAt");
