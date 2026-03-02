-- CreateTable
CREATE TABLE "AdminServiceCountryCustomPrice" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "country" INTEGER NOT NULL,
    "customPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminServiceCountryCustomPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminServiceCountryCustomPrice_service_idx" ON "AdminServiceCountryCustomPrice"("service");

-- CreateIndex
CREATE INDEX "AdminServiceCountryCustomPrice_country_idx" ON "AdminServiceCountryCustomPrice"("country");

-- CreateIndex
CREATE UNIQUE INDEX "AdminServiceCountryCustomPrice_service_country_key" ON "AdminServiceCountryCustomPrice"("service", "country");
