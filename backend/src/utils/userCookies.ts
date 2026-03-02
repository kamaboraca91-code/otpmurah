import type { CookieOptions } from "express";
import { env } from "../env";

export const REFRESH_COOKIE_NAME = "refreshToken";
export const CSRF_COOKIE_NAME = "csrfToken";
export const ACCESS_COOKIE_NAME = "accessToken";

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
}

export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false, // harus bisa dibaca frontend
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
}

export function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
}
