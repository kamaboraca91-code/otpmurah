import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/errors";

// set origin frontend kamu
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
]);

export function requireSameOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get("origin");
  const referer = req.get("referer");

  // Kalau bukan request dari browser (misal curl), origin bisa null -> bolehkan.
  if (!origin && !referer) return next();

  if (origin && ALLOWED_ORIGINS.has(origin)) return next();

  // fallback referer check
  if (referer) {
    for (const allowed of ALLOWED_ORIGINS) {
      if (referer.startsWith(allowed)) return next();
    }
  }

  return next(new HttpError(403, "Bad origin"));
}

// Lebih ketat: wajib ada Origin/Referer browser + harus match allowed origins.
export function requireStrictSameOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (!origin && !referer) {
    return next(new HttpError(403, "Origin/Referer is required"));
  }

  if (origin && ALLOWED_ORIGINS.has(origin)) return next();

  if (referer) {
    for (const allowed of ALLOWED_ORIGINS) {
      if (referer.startsWith(allowed)) return next();
    }
  }

  return next(new HttpError(403, "Bad origin"));
}
