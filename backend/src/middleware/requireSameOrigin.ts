import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/errors";
import { env } from "../env";

function normalizeOrigin(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

const ALLOWED_ORIGINS = new Set(
  [env.FRONTEND_BASE_URL, ...env.CORS_ORIGINS, "http://localhost:5173"]
    .map(normalizeOrigin)
    .filter(Boolean),
);

function isAllowedOrigin(origin?: string | null) {
  const normalized = normalizeOrigin(origin ?? "");
  return normalized ? ALLOWED_ORIGINS.has(normalized) : false;
}

function isAllowedReferer(referer?: string | null) {
  const normalized = normalizeOrigin(referer ?? "");
  if (!normalized) return false;
  return ALLOWED_ORIGINS.has(normalized);
}

export function requireSameOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get("origin");
  const referer = req.get("referer");

  // Kalau bukan request dari browser (misal curl), origin bisa null -> bolehkan.
  if (!origin && !referer) return next();

  if (isAllowedOrigin(origin)) return next();

  // fallback referer check
  if (isAllowedReferer(referer)) return next();

  return next(new HttpError(403, "Bad origin"));
}

// Lebih ketat: wajib ada Origin/Referer browser + harus match allowed origins.
export function requireStrictSameOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (!origin && !referer) {
    return next(new HttpError(403, "Origin/Referer is required"));
  }

  if (isAllowedOrigin(origin)) return next();

  if (isAllowedReferer(referer)) return next();

  return next(new HttpError(403, "Bad origin"));
}
