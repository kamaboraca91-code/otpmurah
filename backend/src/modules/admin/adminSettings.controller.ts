import type { Request, Response } from "express";
import * as svc from "./adminSettings.service";
import { HttpError } from "../../utils/errors";
import { invalidateHeroSmsPricingCaches } from "../herosms/herosms.client";

const DEFAULT_SEO_SETTINGS = {
  metaTitle: "",
  metaDescription: "",
  faviconUrl: null as string | null,
  ogImageUrl: null as string | null,
  twitterCard: "summary_large_image",
  robotsNoIndex: false,
};

const DEFAULT_LANDING_CONTENT = {
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
    "Dibuat untuk alur verifikasi di platform populer - sederhana, cepat, dan ramah privasi.",
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

export async function getPricing(_req: Request, res: Response) {
  const out = await svc.getPricing();
  return res.json(out);
}

export async function updatePricing(req: Request, res: Response) {
  const { profitPercent, usdToIdrRate } = req.body ?? {};

  const p = Number(profitPercent);
  const r = Number(usdToIdrRate);

  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new HttpError(400, "profitPercent must be number between 0 and 100");
  }
  if (!Number.isFinite(r) || r < 1) {
    throw new HttpError(400, "usdToIdrRate must be a positive integer");
  }

  const out = await svc.updatePricing({
    profitPercent: p,
    usdToIdrRate: Math.round(r),
  });

  // Pricing change should be visible immediately for top-countries responses.
  invalidateHeroSmsPricingCaches();

  return res.json(out);
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function extractUploadsPath(value: string) {
  if (!value) return value;
  if (value.startsWith("/uploads/")) return value;

  const marker = "/uploads/";
  const idx = value.indexOf(marker);
  if (idx >= 0) {
    return value.slice(idx);
  }

  return value;
}

function normalizeMediaPathInput(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return extractUploadsPath(text);
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  if (text === "true" || text === "1" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "no") return false;
  return fallback;
}

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertMaxLength(value: string, max: number, label: string) {
  if (value.length > max) {
    throw new HttpError(400, `${label} maksimal ${max} karakter`);
  }
}

function normalizeSeoSettings(value: unknown) {
  const source = isRecord(value) ? value : {};
  const metaTitle = String(source.metaTitle ?? DEFAULT_SEO_SETTINGS.metaTitle).trim();
  const metaDescription = String(
    source.metaDescription ?? DEFAULT_SEO_SETTINGS.metaDescription,
  ).trim();
  const faviconUrl = normalizeMediaPathInput(source.faviconUrl);
  const ogImageUrl = normalizeMediaPathInput(source.ogImageUrl);
  const twitterCardRaw = String(
    source.twitterCard ?? DEFAULT_SEO_SETTINGS.twitterCard,
  )
    .trim()
    .toLowerCase();
  const twitterCard =
    twitterCardRaw === "summary" || twitterCardRaw === "summary_large_image"
      ? twitterCardRaw
      : DEFAULT_SEO_SETTINGS.twitterCard;
  const robotsNoIndex = toBoolean(source.robotsNoIndex, DEFAULT_SEO_SETTINGS.robotsNoIndex);

  assertMaxLength(metaTitle, 160, "Meta title");
  assertMaxLength(metaDescription, 320, "Meta description");
  if (faviconUrl) assertMaxLength(faviconUrl, 1000, "Favicon URL");
  if (ogImageUrl) assertMaxLength(ogImageUrl, 1000, "OG image URL");

  return {
    metaTitle,
    metaDescription,
    faviconUrl,
    ogImageUrl,
    twitterCard,
    robotsNoIndex,
  };
}

function normalizeLandingContent(value: unknown) {
  const source = isRecord(value) ? value : {};
  const normalized = {
    heroBadge: String(source.heroBadge ?? DEFAULT_LANDING_CONTENT.heroBadge).trim(),
    heroTitle: String(source.heroTitle ?? DEFAULT_LANDING_CONTENT.heroTitle).trim(),
    heroHighlight: String(
      source.heroHighlight ?? DEFAULT_LANDING_CONTENT.heroHighlight,
    ).trim(),
    heroDescription: String(
      source.heroDescription ?? DEFAULT_LANDING_CONTENT.heroDescription,
    ).trim(),
    heroPrimaryCta: String(
      source.heroPrimaryCta ?? DEFAULT_LANDING_CONTENT.heroPrimaryCta,
    ).trim(),
    heroSecondaryCta: String(
      source.heroSecondaryCta ?? DEFAULT_LANDING_CONTENT.heroSecondaryCta,
    ).trim(),
    productEyebrow: String(
      source.productEyebrow ?? DEFAULT_LANDING_CONTENT.productEyebrow,
    ).trim(),
    productTitle: String(source.productTitle ?? DEFAULT_LANDING_CONTENT.productTitle).trim(),
    productSubtitle: String(
      source.productSubtitle ?? DEFAULT_LANDING_CONTENT.productSubtitle,
    ).trim(),
    howEyebrow: String(source.howEyebrow ?? DEFAULT_LANDING_CONTENT.howEyebrow).trim(),
    howTitle: String(source.howTitle ?? DEFAULT_LANDING_CONTENT.howTitle).trim(),
    howSubtitle: String(source.howSubtitle ?? DEFAULT_LANDING_CONTENT.howSubtitle).trim(),
    faqEyebrow: String(source.faqEyebrow ?? DEFAULT_LANDING_CONTENT.faqEyebrow).trim(),
    faqTitle: String(source.faqTitle ?? DEFAULT_LANDING_CONTENT.faqTitle).trim(),
    faqSubtitle: String(source.faqSubtitle ?? DEFAULT_LANDING_CONTENT.faqSubtitle).trim(),
    ctaBadge: String(source.ctaBadge ?? DEFAULT_LANDING_CONTENT.ctaBadge).trim(),
    ctaTitle: String(source.ctaTitle ?? DEFAULT_LANDING_CONTENT.ctaTitle).trim(),
    ctaSubtitle: String(source.ctaSubtitle ?? DEFAULT_LANDING_CONTENT.ctaSubtitle).trim(),
    ctaPrimaryCta: String(
      source.ctaPrimaryCta ?? DEFAULT_LANDING_CONTENT.ctaPrimaryCta,
    ).trim(),
    ctaSecondaryCta: String(
      source.ctaSecondaryCta ?? DEFAULT_LANDING_CONTENT.ctaSecondaryCta,
    ).trim(),
  };

  assertMaxLength(normalized.heroBadge, 80, "Hero badge");
  assertMaxLength(normalized.heroTitle, 140, "Hero title");
  assertMaxLength(normalized.heroHighlight, 140, "Hero highlight");
  assertMaxLength(normalized.heroDescription, 500, "Hero description");
  assertMaxLength(normalized.heroPrimaryCta, 60, "Hero tombol utama");
  assertMaxLength(normalized.heroSecondaryCta, 60, "Hero tombol sekunder");
  assertMaxLength(normalized.productEyebrow, 60, "Product eyebrow");
  assertMaxLength(normalized.productTitle, 180, "Product title");
  assertMaxLength(normalized.productSubtitle, 500, "Product subtitle");
  assertMaxLength(normalized.howEyebrow, 60, "How eyebrow");
  assertMaxLength(normalized.howTitle, 180, "How title");
  assertMaxLength(normalized.howSubtitle, 500, "How subtitle");
  assertMaxLength(normalized.faqEyebrow, 60, "FAQ eyebrow");
  assertMaxLength(normalized.faqTitle, 180, "FAQ title");
  assertMaxLength(normalized.faqSubtitle, 500, "FAQ subtitle");
  assertMaxLength(normalized.ctaBadge, 80, "CTA badge");
  assertMaxLength(normalized.ctaTitle, 180, "CTA title");
  assertMaxLength(normalized.ctaSubtitle, 500, "CTA subtitle");
  assertMaxLength(normalized.ctaPrimaryCta, 60, "CTA tombol utama");
  assertMaxLength(normalized.ctaSecondaryCta, 60, "CTA tombol sekunder");

  return normalized;
}

function normalizeSeoForOutput(value: unknown) {
  const seo = normalizeSeoSettings(value);
  return {
    ...seo,
    faviconUrl: seo.faviconUrl ? extractUploadsPath(seo.faviconUrl) : null,
    ogImageUrl: seo.ogImageUrl ? extractUploadsPath(seo.ogImageUrl) : null,
  };
}

function normalizeOptionalDate(value: unknown, fieldName: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    throw new HttpError(400, `${fieldName} tidak valid`);
  }
  return dt;
}

export async function getWebsiteSettingsAdmin(_req: Request, res: Response) {
  const [settings, banners] = await Promise.all([
    svc.getWebsiteSettings(),
    svc.listWebsiteBannersAdmin(),
  ]);

  const normalizedSettings = {
    ...settings,
    logoUrl: settings.logoUrl ? extractUploadsPath(settings.logoUrl) : null,
    seo: normalizeSeoForOutput(settings.seo),
    landingContent: normalizeLandingContent(settings.landingContent),
  };

  const normalizedBanners = banners.map((banner) => ({
    ...banner,
    imageUrl: extractUploadsPath(banner.imageUrl),
  }));

  return res.json({
    ok: true,
    settings: normalizedSettings,
    banners: normalizedBanners,
  });
}

export async function getWebsiteSettingsPublic(_req: Request, res: Response) {
  const [settings, banners] = await Promise.all([
    svc.getWebsiteSettings(),
    svc.listWebsiteBannersPublic(),
  ]);

  const logoUrl = settings.logoUrl ? extractUploadsPath(settings.logoUrl) : null;
  const normalizedBanners = banners.map((banner) => ({
    ...banner,
    imageUrl: extractUploadsPath(banner.imageUrl),
  }));

  return res.json({
    ok: true,
    settings: {
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      logoUrl,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      seo: normalizeSeoForOutput(settings.seo),
      landingContent: normalizeLandingContent(settings.landingContent),
      updatedAt: settings.updatedAt,
    },
    banners: normalizedBanners,
  });
}

export async function updateWebsiteSettings(req: Request, res: Response) {
  const siteName = normalizeText(req.body?.siteName);
  const siteDescription = normalizeText(req.body?.siteDescription);
  const logoUrl = normalizeMediaPathInput(req.body?.logoUrl);
  const maintenanceMode = toBoolean(req.body?.maintenanceMode, false);
  const maintenanceMessage = normalizeOptionalText(req.body?.maintenanceMessage);
  const seo = normalizeSeoSettings(req.body?.seo);
  const landingContent = normalizeLandingContent(req.body?.landingContent);

  if (!siteName) throw new HttpError(400, "Nama website wajib diisi");
  if (siteName.length > 120) throw new HttpError(400, "Nama website maksimal 120 karakter");
  if (!siteDescription) throw new HttpError(400, "Deskripsi website wajib diisi");
  if (siteDescription.length > 400) throw new HttpError(400, "Deskripsi website maksimal 400 karakter");
  if (logoUrl && logoUrl.length > 1000) throw new HttpError(400, "URL logo terlalu panjang");
  if (maintenanceMessage && maintenanceMessage.length > 500) {
    throw new HttpError(400, "Pesan maintenance maksimal 500 karakter");
  }

  const settings = await svc.updateWebsiteSettings({
    siteName,
    siteDescription,
    logoUrl,
    maintenanceMode,
    maintenanceMessage,
    seo,
    landingContent,
  });

  return res.json({ ok: true, settings });
}

export async function uploadWebsiteImage(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    throw new HttpError(400, "File gambar wajib diupload");
  }

  const pathName = `/uploads/website/${file.filename}`;
  const fileUrl = `${req.protocol}://${req.get("host")}${pathName}`;

  return res.json({
    ok: true,
    file: {
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      path: pathName,
      url: fileUrl,
    },
  });
}

export async function createWebsiteBanner(req: Request, res: Response) {
  const imageUrl = normalizeMediaPathInput(req.body?.imageUrl) ?? "";
  const title = normalizeOptionalText(req.body?.title);
  const subtitle = normalizeOptionalText(req.body?.subtitle);
  const linkUrl = normalizeOptionalText(req.body?.linkUrl);
  const sortOrder = Math.max(0, toInt(req.body?.sortOrder, 0));
  const isActive = toBoolean(req.body?.isActive, true);
  const startAt = normalizeOptionalDate(req.body?.startAt, "startAt");
  const endAt = normalizeOptionalDate(req.body?.endAt, "endAt");

  if (!imageUrl) throw new HttpError(400, "Image URL wajib diisi");
  if (imageUrl.length > 1000) throw new HttpError(400, "Image URL terlalu panjang");
  if (title && title.length > 120) throw new HttpError(400, "Judul banner maksimal 120 karakter");
  if (subtitle && subtitle.length > 240) throw new HttpError(400, "Subjudul banner maksimal 240 karakter");
  if (linkUrl && linkUrl.length > 1000) throw new HttpError(400, "Link URL terlalu panjang");
  if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
    throw new HttpError(400, "Waktu mulai banner tidak boleh melebihi waktu berakhir");
  }

  const banner = await svc.createWebsiteBanner({
    imageUrl,
    title,
    subtitle,
    linkUrl,
    sortOrder,
    isActive,
    startAt,
    endAt,
    adminId: req.adminId,
  });

  return res.json({ ok: true, banner });
}

export async function updateWebsiteBanner(req: Request, res: Response) {
  const id = normalizeText(req.params.id);
  if (!id) throw new HttpError(400, "Missing banner id");

  const imageUrl = normalizeMediaPathInput(req.body?.imageUrl) ?? "";
  const title = normalizeOptionalText(req.body?.title);
  const subtitle = normalizeOptionalText(req.body?.subtitle);
  const linkUrl = normalizeOptionalText(req.body?.linkUrl);
  const sortOrder = Math.max(0, toInt(req.body?.sortOrder, 0));
  const isActive = toBoolean(req.body?.isActive, true);
  const startAt = normalizeOptionalDate(req.body?.startAt, "startAt");
  const endAt = normalizeOptionalDate(req.body?.endAt, "endAt");

  if (!imageUrl) throw new HttpError(400, "Image URL wajib diisi");
  if (imageUrl.length > 1000) throw new HttpError(400, "Image URL terlalu panjang");
  if (title && title.length > 120) throw new HttpError(400, "Judul banner maksimal 120 karakter");
  if (subtitle && subtitle.length > 240) throw new HttpError(400, "Subjudul banner maksimal 240 karakter");
  if (linkUrl && linkUrl.length > 1000) throw new HttpError(400, "Link URL terlalu panjang");
  if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
    throw new HttpError(400, "Waktu mulai banner tidak boleh melebihi waktu berakhir");
  }

  const banner = await svc.updateWebsiteBanner(id, {
    imageUrl,
    title,
    subtitle,
    linkUrl,
    sortOrder,
    isActive,
    startAt,
    endAt,
    adminId: req.adminId,
  });

  return res.json({ ok: true, banner });
}

export async function deleteWebsiteBanner(req: Request, res: Response) {
  const id = normalizeText(req.params.id);
  if (!id) throw new HttpError(400, "Missing banner id");

  await svc.deleteWebsiteBanner(id);

  return res.json({ ok: true });
}
