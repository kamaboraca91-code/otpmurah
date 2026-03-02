-- CreateTable
CREATE TABLE "NewsInfo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tag" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsInfo_isPublished_publishedAt_idx" ON "NewsInfo"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsInfo_createdAt_idx" ON "NewsInfo"("createdAt");
