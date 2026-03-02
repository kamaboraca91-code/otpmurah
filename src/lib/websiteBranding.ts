import { API_BASE, apiFetch } from "./api";

export type WebsiteBranding = {
  siteName: string;
  siteDescription: string;
  logoUrl: string | null;
};

const DEFAULT_BRANDING: WebsiteBranding = {
  siteName: "OTP Seller",
  siteDescription: "Platform pembelian nomor OTP virtual",
  logoUrl: null,
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

function normalizeBranding(data: any): WebsiteBranding {
  const settings = data?.settings ?? {};
  const siteName = String(settings?.siteName ?? "").trim() || DEFAULT_BRANDING.siteName;
  const siteDescription =
    String(settings?.siteDescription ?? "").trim() || DEFAULT_BRANDING.siteDescription;

  return {
    siteName,
    siteDescription,
    logoUrl: resolveMediaUrl(settings?.logoUrl),
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
