-- CreateTable
CREATE TABLE "UserTopup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reffId" TEXT NOT NULL,
    "methodCode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "totalBayar" INTEGER,
    "totalDiterima" INTEGER,
    "providerRef" TEXT,
    "providerTrxId" TEXT,
    "providerStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payUrl" TEXT,
    "checkoutUrl" TEXT,
    "qrLink" TEXT,
    "qrString" TEXT,
    "nomorVa" TEXT,
    "panduanPembayaran" TEXT,
    "paidAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "rawCreate" JSONB,
    "rawStatus" JSONB,
    "rawWebhook" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTopup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTopup_reffId_key" ON "UserTopup"("reffId");

-- CreateIndex
CREATE INDEX "UserTopup_userId_createdAt_idx" ON "UserTopup"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserTopup_userId_status_idx" ON "UserTopup"("userId", "status");

-- CreateIndex
CREATE INDEX "UserTopup_reffId_idx" ON "UserTopup"("reffId");

-- AddForeignKey
ALTER TABLE "UserTopup"
ADD CONSTRAINT "UserTopup_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
