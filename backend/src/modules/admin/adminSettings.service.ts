import { prisma } from "../../prisma";

const SINGLETON_ID = "singleton";

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
    },
  });
}

export async function updateWebsiteSettings(input: {
  siteName: string;
  siteDescription: string;
  logoUrl: string | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
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
    },
    update: {
      siteName: input.siteName,
      siteDescription: input.siteDescription,
      logoUrl: input.logoUrl,
      maintenanceMode: input.maintenanceMode,
      maintenanceMessage: input.maintenanceMessage,
    },
  });
}

export async function listWebsiteBannersAdmin() {
  return prisma.websiteBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function listWebsiteBannersPublic() {
  return prisma.websiteBanner.findMany({
    where: { isActive: true },
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
      updatedByAdminId: input.adminId ?? null,
    },
  });
}

export async function deleteWebsiteBanner(id: string) {
  return prisma.websiteBanner.delete({
    where: { id },
  });
}
