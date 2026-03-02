-- AlterTable
ALTER TABLE "User"
ADD COLUMN "balance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserNumberOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activationId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "country" INTEGER NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STATUS_WAIT_CODE',
    "smsCode" TEXT,
    "smsText" TEXT,
    "smsPayload" JSONB,
    "providerRaw" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNumberOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserNumberOrder_activationId_key" ON "UserNumberOrder"("activationId");

-- CreateIndex
CREATE INDEX "UserNumberOrder_userId_createdAt_idx" ON "UserNumberOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserNumberOrder_userId_status_idx" ON "UserNumberOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "UserNumberOrder_service_country_idx" ON "UserNumberOrder"("service", "country");

-- AddForeignKey
ALTER TABLE "UserNumberOrder"
ADD CONSTRAINT "UserNumberOrder_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
