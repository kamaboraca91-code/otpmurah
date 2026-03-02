import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../prisma";
import { HttpError } from "../../utils/errors";
import { generateCsrfToken } from "../../utils/csrf";
import * as svc from "./adminAuth.service";
import {
  ADMIN_REFRESH_COOKIE_NAME,
  ADMIN_ACCESS_COOKIE_NAME,
  ADMIN_CSRF_COOKIE_NAME,
  adminRefreshCookieOptions,
  adminAccessCookieOptions,
  adminCsrfCookieOptions,
} from "../../utils/adminCookies";
import { verifyAdminAccessToken } from "./adminAuth.service";
import { verifyTurnstileToken } from "../../utils/turnstile";
import {
  clearLoginFailures,
  getLoginCaptchaKey,
  isLoginCaptchaRequired,
  markLoginFailure,
} from "../../utils/loginCaptcha";

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(72),
  captchaToken: z.string().trim().min(1, "Captcha wajib diisi.").optional(),
});

export async function login(req: Request, res: Response) {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Validation error", issues: parsed.error.issues });
  }

  const loginKey = getLoginCaptchaKey({
    scope: "admin",
    email: parsed.data.email,
    ip: req.ip,
  });

  if (isLoginCaptchaRequired(loginKey)) {
    if (!parsed.data.captchaToken) {
      return res.status(400).json({
        message: "Selesaikan captcha untuk melanjutkan login admin.",
        captchaRequired: true,
      });
    }
    try {
      await verifyTurnstileToken({
        token: parsed.data.captchaToken,
        remoteIp: req.ip,
      });
    } catch (err: any) {
      return res.status(400).json({
        message: err?.message ?? "Verifikasi captcha gagal. Coba lagi.",
        captchaRequired: true,
      });
    }
  }

  let out: Awaited<ReturnType<typeof svc.login>>;
  try {
    out = await svc.login(
      { email: parsed.data.email, password: parsed.data.password },
      { userAgent: req.get("user-agent") ?? undefined, ip: req.ip },
    );
  } catch (err: any) {
    if (err instanceof HttpError && err.status === 401) {
      const captchaRequired = markLoginFailure(loginKey);
      return res.status(401).json({
        message: captchaRequired
          ? "Login admin gagal. Selesaikan captcha untuk percobaan berikutnya."
          : "Invalid credentials",
        captchaRequired,
      });
    }
    throw err;
  }

  clearLoginFailures(loginKey);

  res.cookie(ADMIN_REFRESH_COOKIE_NAME, out.refreshToken, {
    ...adminRefreshCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });

  const csrfToken = generateCsrfToken();
  res.cookie(ADMIN_CSRF_COOKIE_NAME, csrfToken, {
    ...adminCsrfCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });

  res.cookie(ADMIN_ACCESS_COOKIE_NAME, out.accessToken, {
    ...adminAccessCookieOptions(),
    maxAge: 1000 * 60 * 15,
  });

  return res.json({ admin: out.admin, accessToken: out.accessToken });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_REFRESH_COOKIE_NAME];
  if (!token) throw new HttpError(401, "Missing admin refresh token cookie");

  const out = await svc.refresh(token, {
    userAgent: req.get("user-agent") ?? undefined,
    ip: req.ip,
  });

  res.cookie(ADMIN_REFRESH_COOKIE_NAME, out.refreshToken, {
    ...adminRefreshCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });

  const csrfToken = generateCsrfToken();
  res.cookie(ADMIN_CSRF_COOKIE_NAME, csrfToken, {
    ...adminCsrfCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });

  res.cookie(ADMIN_ACCESS_COOKIE_NAME, out.accessToken, {
    ...adminAccessCookieOptions(),
    maxAge: 1000 * 60 * 15,
  });

  return res.json({ admin: out.admin, accessToken: out.accessToken });
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_REFRESH_COOKIE_NAME];
  if (token) await svc.revokeSessionByRefreshToken(token);

  res.clearCookie(ADMIN_REFRESH_COOKIE_NAME, adminRefreshCookieOptions());
  res.clearCookie(ADMIN_CSRF_COOKIE_NAME, adminCsrfCookieOptions());
  res.clearCookie(ADMIN_ACCESS_COOKIE_NAME, adminAccessCookieOptions());

  return res.json({ ok: true });
}

/** ✅ restore admin session on refresh page */
export async function me(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_ACCESS_COOKIE_NAME];
  if (!token) return res.json({ admin: null });

  try {
    const { adminId } = verifyAdminAccessToken(token);

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!admin || !admin.isActive) return res.json({ admin: null });

    return res.json({ admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch {
    return res.json({ admin: null });
  }
}
