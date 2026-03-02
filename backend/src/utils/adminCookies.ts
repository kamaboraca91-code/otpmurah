import type { CookieOptions } from "express";
import { env } from "../env";

export const ADMIN_REFRESH_COOKIE_NAME = "adm_refresh";
export const ADMIN_ACCESS_COOKIE_NAME = "adm_access";
export const ADMIN_CSRF_COOKIE_NAME = "adm_csrf";

export function adminRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function adminAccessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function adminCsrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false, // frontend perlu baca untuk header X-CSRF (kalau kamu pakai)
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}
