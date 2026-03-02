import type { Request, Response } from "express";
import * as svc from "./adminSettings.service";
import { HttpError } from "../../utils/errors";
import { invalidateHeroSmsPricingCaches } from "../herosms/herosms.client";

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

export async function getWebsiteSettingsAdmin(_req: Request, res: Response) {
  const [settings, banners] = await Promise.all([
    svc.getWebsiteSettings(),
    svc.listWebsiteBannersAdmin(),
  ]);

  const normalizedSettings = {
    ...settings,
    logoUrl: settings.logoUrl ? extractUploadsPath(settings.logoUrl) : null,
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

  if (!imageUrl) throw new HttpError(400, "Image URL wajib diisi");
  if (imageUrl.length > 1000) throw new HttpError(400, "Image URL terlalu panjang");
  if (title && title.length > 120) throw new HttpError(400, "Judul banner maksimal 120 karakter");
  if (subtitle && subtitle.length > 240) throw new HttpError(400, "Subjudul banner maksimal 240 karakter");
  if (linkUrl && linkUrl.length > 1000) throw new HttpError(400, "Link URL terlalu panjang");

  const banner = await svc.createWebsiteBanner({
    imageUrl,
    title,
    subtitle,
    linkUrl,
    sortOrder,
    isActive,
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

  if (!imageUrl) throw new HttpError(400, "Image URL wajib diisi");
  if (imageUrl.length > 1000) throw new HttpError(400, "Image URL terlalu panjang");
  if (title && title.length > 120) throw new HttpError(400, "Judul banner maksimal 120 karakter");
  if (subtitle && subtitle.length > 240) throw new HttpError(400, "Subjudul banner maksimal 240 karakter");
  if (linkUrl && linkUrl.length > 1000) throw new HttpError(400, "Link URL terlalu panjang");

  const banner = await svc.updateWebsiteBanner(id, {
    imageUrl,
    title,
    subtitle,
    linkUrl,
    sortOrder,
    isActive,
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
