import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function normalizeEmailForKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function ipKey(req: Request) {
  const raw = req.ip || req.socket.remoteAddress || "";
  return ipKeyGenerator(String(raw));
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,                  // 10 request / 15 menit per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});

export const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 30,                 // 30 refresh / 5 menit per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many refresh requests, slow down." },
});

export const registerCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 8,                   // max 8 kirim kode / 15 menit / IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: {
    message: "Terlalu banyak permintaan kode verifikasi. Coba lagi nanti.",
  },
});

export const registerCodeEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 4,                   // max 4 kirim kode / 15 menit / email
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = normalizeEmailForKey((req as any).body?.email);
    return `email:${email || "unknown"}`;
  },
  skip: (req) => !normalizeEmailForKey((req as any).body?.email),
  message: {
    message: "Permintaan kode untuk email ini terlalu sering. Coba lagi nanti.",
  },
});

export const registerSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 12,                  // max submit register / 15 menit / IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: {
    message: "Terlalu banyak percobaan registrasi. Coba lagi nanti.",
  },
});

export const passwordResetCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 8,                   // max 8 kirim link reset / 15 menit / IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: {
    message: "Terlalu banyak permintaan reset password. Coba lagi nanti.",
  },
});

export const passwordResetCodeEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 4,                   // max 4 kirim link reset / 15 menit / email
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = normalizeEmailForKey((req as any).body?.email);
    return `pw-reset-email:${email || "unknown"}`;
  },
  skip: (req) => !normalizeEmailForKey((req as any).body?.email),
  message: {
    message: "Permintaan link reset password untuk email ini terlalu sering.",
  },
});

export const passwordResetSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 12,                  // max submit reset / 15 menit / IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: {
    message: "Terlalu banyak percobaan reset password. Coba lagi nanti.",
  },
});

export const heroSmsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 30,             // max 30 request / menit per IP (sesuaikan)
  standardHeaders: true,
  legacyHeaders: false,
});
