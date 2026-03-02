-- CreateTable
CREATE TABLE "UserBalanceMutation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBalanceMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBalanceMutation_userId_createdAt_idx" ON "UserBalanceMutation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserBalanceMutation_userId_type_idx" ON "UserBalanceMutation"("userId", "type");

-- CreateIndex
CREATE INDEX "UserBalanceMutation_userId_direction_idx" ON "UserBalanceMutation"("userId", "direction");

-- CreateIndex
CREATE INDEX "UserBalanceMutation_referenceType_referenceId_idx" ON "UserBalanceMutation"("referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "UserBalanceMutation"
ADD CONSTRAINT "UserBalanceMutation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;