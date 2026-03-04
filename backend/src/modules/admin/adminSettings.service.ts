import { prisma } from "../../prisma";
import type { Prisma } from "@prisma/client";

const SINGLETON_ID = "singleton";
const DEFAULT_SEO: Prisma.InputJsonObject = {
  metaTitle: "",
  metaDescription: "",
  faviconUrl: null,
  ogImageUrl: null,
  twitterCard: "summary_large_image",
  robotsNoIndex: false,
};

const DEFAULT_LANDING_CONTENT: Prisma.InputJsonObject = {
  heroBadge: "Layanan aktif",
  heroTitle: "Terima OTP SMS",
  heroHighlight: "dengan nomor virtual",
  heroDescription:
    "Pilih negara dan layanan, beli nomor, lalu terima kode verifikasi secara instan. Cocok untuk messenger, media sosial, marketplace, dan lainnya.",
  heroPrimaryCta: "Mulai Sekarang",
  heroSecondaryCta: "Cara kerja",
  productEyebrow: "Produk",
  productTitle: "Kenapa memilih nomor virtual kami",
  productSubtitle:
    "Dibuat untuk alur verifikasi di platform populer — sederhana, cepat, dan ramah privasi.",
  howEyebrow: "Cara kerja",
  howTitle: "Lima langkah mudah untuk menerima OTP",
  howSubtitle: "Alur sederhana untuk kebutuhan verifikasi harian.",
  faqEyebrow: "FAQ",
  faqTitle: "Pertanyaan yang sering ditanyakan",
  faqSubtitle: "Jawaban singkat untuk pertanyaan paling umum tentang layanan kami.",
  ctaBadge: "Siap mulai?",
  ctaTitle: "Mulai terima OTP SMS hari ini",
  ctaSubtitle:
    "Bergabung dengan ribuan pengguna yang mempercayai platform kami untuk verifikasi SMS yang cepat, andal, dan aman.",
  ctaPrimaryCta: "Buat akun gratis",
  ctaSecondaryCta: "Pelajari lebih lanjut",
};

export async function getPricing() {
  const row = await prisma.adminPricingSettings.findUnique({
    where: { id: SINGLETON_ID },
  });

  if (!row) {
    const created = await prisma.adminPricingSettings.create({
      data: { id: SINGLETON_ID, profitPercent: 10, usdToIdrRate: 16000 },
    });
    return created;
  }

  return row;
}

export async function updatePricing(input: { profitPercent: number; usdToIdrRate: number }) {
  const row = await prisma.adminPricingSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      profitPercent: input.profitPercent,
      usdToIdrRate: input.usdToIdrRate,
    },
    update: {
      profitPercent: input.profitPercent,
      usdToIdrRate: input.usdToIdrRate,
    },
  });

  return row;
}

export async function getWebsiteSettings() {
  const row = await prisma.websiteSettings.findUnique({
    where: { id: SINGLETON_ID },
  });

  if (row) return row;

  return prisma.websiteSettings.create({
    data: {
      id: SINGLETON_ID,
      siteName: "OTP Seller",
      siteDescription: "Platform pembelian nomor OTP virtual",
      maintenanceMode: false,
      seo: DEFAULT_SEO,
      landingContent: DEFAULT_LANDING_CONTENT,
    },
  });
}

export async function updateWebsiteSettings(input: {
  siteName: string;
  siteDescription: string;
  logoUrl: string | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  seo: Prisma.InputJsonValue;
  landingContent: Prisma.InputJsonValue;
}) {
  return prisma.websiteSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      siteName: input.siteName,
      siteDescription: input.siteDescription,
      logoUrl: input.logoUrl,
      maintenanceMode: input.maintenanceMode,
      maintenanceMessage: input.maintenanceMessage,
      seo: input.seo,
      landingContent: input.landingContent,
    },
    update: {
      siteName: input.siteName,
      siteDescription: input.siteDescription,
      logoUrl: input.logoUrl,
      maintenanceMode: input.maintenanceMode,
      maintenanceMessage: input.maintenanceMessage,
      seo: input.seo,
      landingContent: input.landingContent,
    },
  });
}

export async function listWebsiteBannersAdmin() {
  return prisma.websiteBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function listWebsiteBannersPublic() {
  const now = new Date();
  return prisma.websiteBanner.findMany({
    where: {
      isActive: true,
      AND: [
        {
          OR: [{ startAt: null }, { startAt: { lte: now } }],
        },
        {
          OR: [{ endAt: null }, { endAt: { gte: now } }],
        },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function createWebsiteBanner(input: {
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startAt: Date | null;
  endAt: Date | null;
  adminId?: string;
}) {
  return prisma.websiteBanner.create({
    data: {
      imageUrl: input.imageUrl,
      title: input.title,
      subtitle: input.subtitle,
      linkUrl: input.linkUrl,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      startAt: input.startAt,
      endAt: input.endAt,
      createdByAdminId: input.adminId ?? null,
      updatedByAdminId: input.adminId ?? null,
    },
  });
}

export async function updateWebsiteBanner(
  id: string,
  input: {
    imageUrl: string;
    title: string | null;
    subtitle: string | null;
    linkUrl: string | null;
    sortOrder: number;
    isActive: boolean;
    startAt: Date | null;
    endAt: Date | null;
    adminId?: string;
  },
) {
  return prisma.websiteBanner.update({
    where: { id },
    data: {
      imageUrl: input.imageUrl,
      title: input.title,
      subtitle: input.subtitle,
      linkUrl: input.linkUrl,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      startAt: input.startAt,
      endAt: input.endAt,
      updatedByAdminId: input.adminId ?? null,
    },
  });
}

export async function deleteWebsiteBanner(id: string) {
  return prisma.websiteBanner.delete({
    where: { id },
  });
}
