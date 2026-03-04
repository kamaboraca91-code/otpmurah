import { API_BASE, apiFetch } from "./api";

export type WebsiteSeoSettings = {
  metaTitle: string;
  metaDescription: string;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  twitterCard: "summary" | "summary_large_image";
  robotsNoIndex: boolean;
};

export type WebsiteLandingContent = {
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  productEyebrow: string;
  productTitle: string;
  productSubtitle: string;
  howEyebrow: string;
  howTitle: string;
  howSubtitle: string;
  faqEyebrow: string;
  faqTitle: string;
  faqSubtitle: string;
  ctaBadge: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPrimaryCta: string;
  ctaSecondaryCta: string;
};

export type WebsiteBranding = {
  siteName: string;
  siteDescription: string;
  logoUrl: string | null;
  seo: WebsiteSeoSettings;
  landingContent: WebsiteLandingContent;
};

const DEFAULT_SEO: WebsiteSeoSettings = {
  metaTitle: "",
  metaDescription: "",
  faviconUrl: null,
  ogImageUrl: null,
  twitterCard: "summary_large_image",
  robotsNoIndex: false,
};

const DEFAULT_LANDING_CONTENT: WebsiteLandingContent = {
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

const DEFAULT_BRANDING: WebsiteBranding = {
  siteName: "OTP Seller",
  siteDescription: "Platform pembelian nomor OTP virtual",
  logoUrl: null,
  seo: DEFAULT_SEO,
  landingContent: DEFAULT_LANDING_CONTENT,
};

let brandingCache: WebsiteBranding | null = null;
let brandingPromise: Promise<WebsiteBranding> | null = null;

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${API_BASE}${raw}`;
  return `${API_BASE}/${raw}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSeo(input: unknown): WebsiteSeoSettings {
  const source = isObject(input) ? input : {};
  const twitterRaw = String(source.twitterCard ?? DEFAULT_SEO.twitterCard).trim().toLowerCase();
  return {
    metaTitle: String(source.metaTitle ?? DEFAULT_SEO.metaTitle).trim(),
    metaDescription: String(source.metaDescription ?? DEFAULT_SEO.metaDescription).trim(),
    faviconUrl: resolveMediaUrl(String(source.faviconUrl ?? "").trim()),
    ogImageUrl: resolveMediaUrl(String(source.ogImageUrl ?? "").trim()),
    twitterCard: twitterRaw === "summary" ? "summary" : "summary_large_image",
    robotsNoIndex: Boolean(source.robotsNoIndex ?? DEFAULT_SEO.robotsNoIndex),
  };
}

function normalizeLandingContent(input: unknown): WebsiteLandingContent {
  const source = isObject(input) ? input : {};
  return {
    heroBadge: String(source.heroBadge ?? DEFAULT_LANDING_CONTENT.heroBadge).trim(),
    heroTitle: String(source.heroTitle ?? DEFAULT_LANDING_CONTENT.heroTitle).trim(),
    heroHighlight: String(source.heroHighlight ?? DEFAULT_LANDING_CONTENT.heroHighlight).trim(),
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
}

function normalizeBranding(data: any): WebsiteBranding {
  const settings = data?.settings ?? {};
  const siteName = String(settings?.siteName ?? "").trim() || DEFAULT_BRANDING.siteName;
  const siteDescription =
    String(settings?.siteDescription ?? "").trim() || DEFAULT_BRANDING.siteDescription;

  return {
    siteName,
    siteDescription,
    logoUrl: resolveMediaUrl(settings?.logoUrl),
    seo: normalizeSeo(settings?.seo),
    landingContent: normalizeLandingContent(settings?.landingContent),
  };
}

export async function getWebsiteBranding(forceRefresh = false): Promise<WebsiteBranding> {
  if (!forceRefresh && brandingCache) return brandingCache;

  if (!forceRefresh && brandingPromise) return brandingPromise;

  brandingPromise = (async () => {
    try {
      const data = await apiFetch("/api/website", { method: "GET" });
      const next = normalizeBranding(data);
      brandingCache = next;
      return next;
    } catch {
      return brandingCache ?? DEFAULT_BRANDING;
    } finally {
      brandingPromise = null;
    }
  })();

  return brandingPromise;
}

export function getDefaultWebsiteBranding() {
  return DEFAULT_BRANDING;
}
