import "dotenv/config";

type SameSiteValue = "lax" | "strict" | "none";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function smtpFamilyFromEnv(name: string) {
  const raw = process.env[name];
  if (!raw) return 0;
  const n = Number(raw);
  if (n === 4 || n === 6) return n;
  return 0;
}

function boolFromEnv(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function csvFromEnv(name: string, fallback: string[]) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const list = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

function sameSiteFromEnv(name: string, fallback: SameSiteValue): SameSiteValue {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "lax" || value === "strict" || value === "none") return value;
  return fallback;
}

function stringFromEnv(name: string, fallback: string) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = raw.trim();
  return value || fallback;
}

function normalizeOrigin(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function normalizeCookieDomain(rawValue: string | undefined) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (["value", "none", "null", "undefined", "false", "-"].includes(lower)) {
    return "";
  }

  let candidate = raw;
  try {
    candidate = new URL(raw).hostname;
  } catch {
    // keep as-is
  }

  candidate = candidate
    .trim()
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^\.+/, "")
    .toLowerCase();

  if (!candidate || candidate === "localhost") return "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(candidate)) return "";
  if (!/^[a-z0-9.-]+$/.test(candidate)) return "";
  return candidate;
}

const frontendBaseUrl = normalizeOrigin(
  stringFromEnv("FRONTEND_BASE_URL", "http://localhost:5173"),
);
const cookieSameSite = sameSiteFromEnv("COOKIE_SAME_SITE", "lax");
const cookieSecure = cookieSameSite === "none" ? true : boolFromEnv("COOKIE_SECURE", false);
const cookieDomain = normalizeCookieDomain(process.env.COOKIE_DOMAIN);
const corsOrigins = csvFromEnv("CORS_ORIGINS", [frontendBaseUrl || "http://localhost:5173"])
  .map(normalizeOrigin)
  .filter(Boolean);

export const env = {
  PORT: intFromEnv("PORT", 4000),

  // User auth
  JWT_ACCESS_SECRET: must("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: must("JWT_REFRESH_SECRET"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "30d",

  // Cookies
  COOKIE_SECURE: cookieSecure,
  COOKIE_SAME_SITE: cookieSameSite,
  COOKIE_DOMAIN: cookieDomain,

  // CORS
  CORS_ORIGINS: corsOrigins,

  // Admin auth
  JWT_ADMIN_ACCESS_SECRET: must("JWT_ADMIN_ACCESS_SECRET"),
  JWT_ADMIN_REFRESH_SECRET: must("JWT_ADMIN_REFRESH_SECRET"),
  ADMIN_ACCESS_TOKEN_TTL: process.env.ADMIN_ACCESS_TOKEN_TTL ?? "15m",
  ADMIN_REFRESH_TOKEN_TTL: process.env.ADMIN_REFRESH_TOKEN_TTL ?? "30d",

  // Hero SMS
  HEROSMS_API_KEY: process.env.HEROSMS_API_KEY ?? "",
  HEROSMS_BASE_URL: process.env.HEROSMS_BASE_URL ?? "",
  HEROSMS_WEBHOOK_SECRET: process.env.HEROSMS_WEBHOOK_SECRET ?? "",
  HEROSMS_SERVICES_CACHE_TTL_MS: intFromEnv(
    "HEROSMS_SERVICES_CACHE_TTL_MS",
    5 * 60 * 1000,
  ),
  HEROSMS_COUNTRIES_CACHE_TTL_MS: intFromEnv(
    "HEROSMS_COUNTRIES_CACHE_TTL_MS",
    10 * 60 * 1000,
  ),
  HEROSMS_TOP_COUNTRIES_CACHE_TTL_MS: intFromEnv(
    "HEROSMS_TOP_COUNTRIES_CACHE_TTL_MS",
    60 * 1000,
  ),
  HEROSMS_PRICING_CACHE_TTL_MS: intFromEnv(
    "HEROSMS_PRICING_CACHE_TTL_MS",
    30 * 1000,
  ),

  // Payment gateway
  MYPG_BASE_URL: process.env.MYPG_BASE_URL ?? "https://klikqris.com/api/qrisv2",
  MYPG_API_KEY: process.env.MYPG_API_KEY ?? "",
  MYPG_MERCHANT_ID: process.env.MYPG_MERCHANT_ID ?? "",
  MYPG_CALLBACK_SECRET: process.env.MYPG_CALLBACK_SECRET ?? "",
  MYPG_CALLBACK_URL:
    process.env.MYPG_CALLBACK_URL ?? "http://localhost:4000/webhooks/mypg",

  // Email
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: intFromEnv("SMTP_PORT", 587),
  SMTP_SECURE: boolFromEnv("SMTP_SECURE", false),
  SMTP_FAMILY: smtpFamilyFromEnv("SMTP_FAMILY"),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL ?? "",
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME ?? "OTP Seller",
  EMAIL_PROVIDER: stringFromEnv("EMAIL_PROVIDER", "auto"),
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_API_URL: stringFromEnv("RESEND_API_URL", "https://api.resend.com/emails"),
  FRONTEND_BASE_URL: frontendBaseUrl || "http://localhost:5173",

  // Turnstile
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "",
  TURNSTILE_VERIFY_URL:
    process.env.TURNSTILE_VERIFY_URL ??
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  TURNSTILE_EXPECTED_HOST: process.env.TURNSTILE_EXPECTED_HOST ?? "",
};
