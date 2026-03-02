import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  requestPasswordResetLinkSchema,
  requestRegisterCodeSchema,
  resetPasswordByLinkSchema,
  validatePasswordResetLinkSchema,
} from "./auth.schema";
import * as svc from "./auth.service";
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  CSRF_COOKIE_NAME,
  csrfCookieOptions,
  ACCESS_COOKIE_NAME,
  accessCookieOptions,
} from "../../utils/userCookies";
import { HttpError } from "../../utils/errors";
import { generateCsrfToken } from "../../utils/csrf";
import { verifyTurnstileToken } from "../../utils/turnstile";
import {
  clearLoginFailures,
  getLoginCaptchaKey,
  isLoginCaptchaRequired,
  markLoginFailure,
} from "../../utils/loginCaptcha";

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

export async function requestRegisterCode(req: Request, res: Response) {
  const parsed = requestRegisterCodeSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Validation error", issues: parsed.error.issues });

  await verifyTurnstileToken({
    token: parsed.data.captchaToken,
    remoteIp: req.ip,
  });

  const out = await svc.requestRegisterVerificationCode(parsed.data);
  return res.json({ ok: true, ...out });
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Validation error", issues: parsed.error.issues });

  await svc.ensureEmailNotRegistered(parsed.data.email);
  await svc.consumeRegisterVerificationCode({
    email: parsed.data.email,
    verificationCode: parsed.data.verificationCode,
  });

  const user = await svc.register({
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name,
  });
  return res.status(201).json({ user });
}

export async function requestPasswordResetLink(req: Request, res: Response) {
  const parsed = requestPasswordResetLinkSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Validation error", issues: parsed.error.issues });

  await verifyTurnstileToken({
    token: parsed.data.captchaToken,
    remoteIp: req.ip,
  });

  const out = await svc.requestPasswordResetLink({
    email: parsed.data.email,
  });
  return res.json({ ok: true, ...out });
}

export async function resetPasswordByLink(req: Request, res: Response) {
  const parsed = resetPasswordByLinkSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Validation error", issues: parsed.error.issues });

  await svc.resetPasswordWithLink({
    token: parsed.data.token,
    newPassword: parsed.data.newPassword,
  });

  return res.json({ ok: true });
}

export async function validatePasswordResetLink(req: Request, res: Response) {
  const parsed = validatePasswordResetLinkSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Validation error", issues: parsed.error.issues });

  await svc.ensurePasswordResetLinkValid(parsed.data.token);
  return res.json({ ok: true });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Validation error", issues: parsed.error.issues });

  const loginKey = getLoginCaptchaKey({
    scope: "user",
    email: parsed.data.email,
    ip: req.ip,
  });

  if (isLoginCaptchaRequired(loginKey)) {
    if (!parsed.data.captchaToken) {
      return res.status(400).json({
        message: "Selesaikan captcha untuk melanjutkan login.",
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
      {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      {
        userAgent: req.get("user-agent") ?? undefined,
        ip: req.ip,
      },
    );
  } catch (err: any) {
    if (err instanceof HttpError && err.status === 401) {
      const captchaRequired = markLoginFailure(loginKey);
      return res.status(401).json({
        message: captchaRequired
          ? "Login gagal. Selesaikan captcha untuk percobaan berikutnya."
          : "Invalid credentials",
        captchaRequired,
      });
    }
    throw err;
  }

  clearLoginFailures(loginKey);

  // refresh cookie
  res.cookie(REFRESH_COOKIE_NAME, out.refreshToken, {
    ...refreshCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });

  // csrf cookie (readable by frontend)
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...csrfCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });
  res.cookie(ACCESS_COOKIE_NAME, out.accessToken, {
    ...accessCookieOptions(),
    maxAge: 1000 * 60 * 15, // misal 15 menit (samakan dengan expiry access token kamu)
  });
  return res.json({ user: out.user, accessToken: out.accessToken });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw new HttpError(401, "Missing refresh token cookie");

  const out = await svc.refresh(token, {
    userAgent: req.get("user-agent") ?? undefined,
    ip: req.ip,
  });

  // rotate refresh cookie
  res.cookie(REFRESH_COOKIE_NAME, out.refreshToken, {
    ...refreshCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });

  // rotate csrf too (recommended)
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...csrfCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });
  res.cookie(ACCESS_COOKIE_NAME, out.accessToken, {
    ...accessCookieOptions(),
    maxAge: 1000 * 60 * 15,
  });
  return res.json({ user: out.user, accessToken: out.accessToken });
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) await svc.revokeSessionByRefreshToken(token);

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions());
  res.clearCookie(ACCESS_COOKIE_NAME, accessCookieOptions());
  return res.json({ ok: true });
}
