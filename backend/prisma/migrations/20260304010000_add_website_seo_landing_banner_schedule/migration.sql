-- AlterTable
ALTER TABLE "WebsiteSettings"
ADD COLUMN "seo" JSONB,
ADD COLUMN "landingContent" JSONB;

-- AlterTable
ALTER TABLE "WebsiteBanner"
ADD COLUMN "startAt" TIMESTAMP(3),
ADD COLUMN "endAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WebsiteBanner_startAt_endAt_idx" ON "WebsiteBanner"("startAt", "endAt");
