-- CreateTable
CREATE TABLE "AdminPricingSettings" (
    "id" TEXT NOT NULL,
    "profitPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "usdToIdrRate" INTEGER NOT NULL DEFAULT 16000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPricingSettings_pkey" PRIMARY KEY ("id")
);
