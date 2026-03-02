// src/modules/auth/auth.service.ts
import bcrypt from "bcrypt";
import { createHash, randomBytes, randomInt, randomUUID } from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../../prisma";
import { env } from "../../env";
import { HttpError } from "../../utils/errors";
import {
  sendPasswordResetLinkEmail,
  sendRegisterVerificationCodeEmail,
} from "../../utils/mailer";

const REGISTER_CODE_LENGTH = 6;
const REGISTER_CODE_TTL_MS = 10 * 60 * 1000;
const REGISTER_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const REGISTER_CODE_MAX_SEND_PER_HOUR = 5;
const REGISTER_CODE_MAX_ATTEMPT = 5;
const PASSWORD_RESET_LINK_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_LINK_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_LINK_MAX_SEND_PER_HOUR = 5;
const ALLOWED_CLOCK_SKEW_MS = 2 * 60 * 1000;

type VerificationCodeRow = {
  email: string;
  codeHash: string;
  attemptCount: number;
  sendCount: number;
  expiresAt: Date;
  lastSentAt: Date;
};

type PasswordResetCodeRow = {
  email: string;
  codeHash: string;
  attemptCount: number;
  sendCount: number;
  expiresAt: Date;
  lastSentAt: Date;
};

async function findVerificationCodeByEmail(email: string) {
  const rows = await prisma.$queryRaw<VerificationCodeRow[]>`
    SELECT
      "email",
      "codeHash",
      "attemptCount",
      "sendCount",
      "expiresAt",
      "lastSentAt"
    FROM "EmailVerificationCode"
    WHERE "email" = ${email}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function upsertVerificationCodeRow(input: {
  email: string;
  codeHash: string;
  expiresAt: Date;
  sendCount: number;
  lastSentAt: Date;
}) {
  await prisma.$executeRaw`
    INSERT INTO "EmailVerificationCode"
      ("id", "email", "codeHash", "attemptCount", "sendCount", "expiresAt", "lastSentAt", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${input.email}, ${input.codeHash}, 0, ${input.sendCount}, ${input.expiresAt}, ${input.lastSentAt}, NOW(), NOW())
    ON CONFLICT ("email")
    DO UPDATE SET
      "codeHash" = EXCLUDED."codeHash",
      "attemptCount" = 0,
      "sendCount" = EXCLUDED."sendCount",
      "expiresAt" = EXCLUDED."expiresAt",
      "lastSentAt" = EXCLUDED."lastSentAt",
      "updatedAt" = NOW()
  `;
}

async function incrementVerificationAttempt(email: string) {
  await prisma.$executeRaw`
    UPDATE "EmailVerificationCode"
    SET "attemptCount" = "attemptCount" + 1, "updatedAt" = NOW()
    WHERE "email" = ${email}
  `;
}

async function deleteVerificationCode(email: string) {
  await prisma.$executeRaw`
    DELETE FROM "EmailVerificationCode" WHERE "email" = ${email}
  `;
}

async function findPasswordResetCodeByEmail(email: string) {
  const rows = await prisma.$queryRaw<PasswordResetCodeRow[]>`
    SELECT
      "email",
      "codeHash",
      "attemptCount",
      "sendCount",
      "expiresAt",
      "lastSentAt"
    FROM "PasswordResetCode"
    WHERE "email" = ${email}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function upsertPasswordResetCodeRow(input: {
  email: string;
  codeHash: string;
  expiresAt: Date;
  sendCount: number;
  lastSentAt: Date;
}) {
  await prisma.$executeRaw`
    INSERT INTO "PasswordResetCode"
      ("id", "email", "codeHash", "attemptCount", "sendCount", "expiresAt", "lastSentAt", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${input.email}, ${input.codeHash}, 0, ${input.sendCount}, ${input.expiresAt}, ${input.lastSentAt}, NOW(), NOW())
    ON CONFLICT ("email")
    DO UPDATE SET
      "codeHash" = EXCLUDED."codeHash",
      "attemptCount" = 0,
      "sendCount" = EXCLUDED."sendCount",
      "expiresAt" = EXCLUDED."expiresAt",
      "lastSentAt" = EXCLUDED."lastSentAt",
      "updatedAt" = NOW()
  `;
}

async function deletePasswordResetCode(email: string) {
  await prisma.$executeRaw`
    DELETE FROM "PasswordResetCode" WHERE "email" = ${email}
  `;
}

async function findPasswordResetCodeByTokenHash(codeHash: string) {
  const rows = await prisma.$queryRaw<PasswordResetCodeRow[]>`
    SELECT
      "email",
      "codeHash",
      "attemptCount",
      "sendCount",
      "expiresAt",
      "lastSentAt"
    FROM "PasswordResetCode"
    WHERE "codeHash" = ${codeHash}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Convert TTL string like "15m", "30d", "12h" into milliseconds.
 */
function ttlToMs(ttl: string) {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`Invalid TTL: ${ttl}`);
  const n = Number(m[1]);
  const unit = m[2];
  const mult =
    unit === "s"
      ? 1000
      : unit === "m"
        ? 60_000
        : unit === "h"
          ? 3_600_000
          : 86_400_000; // d
  return n * mult;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeName(name?: string) {
  const v = name?.trim();
  return v ? v : undefined;
}

function normalizeNumericCode(code: string, length: number) {
  return String(code ?? "").replace(/\D+/g, "").slice(0, length);
}

function normalizeVerificationCode(code: string) {
  return normalizeNumericCode(code, REGISTER_CODE_LENGTH);
}

function generateVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(REGISTER_CODE_LENGTH, "0");
}

function generatePasswordResetToken() {
  return randomBytes(32).toString("hex");
}

function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildPasswordResetUrl(token: string) {
  const base = String(env.FRONTEND_BASE_URL ?? "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * ACCESS TOKEN:
 * payload: { sub: userId, sid: sessionId }
 */
export function signAccessToken(userId: string, sessionId: string) {
  const opts: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as any };
  return jwt.sign({ sub: userId, sid: sessionId }, env.JWT_ACCESS_SECRET, opts);
}

export function verifyAccessToken(token: string): {
  userId: string;
  sessionId: string;
} {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
    const userId = payload?.sub as string | undefined;
    const sessionId = payload?.sid as string | undefined;
    if (!userId || !sessionId) throw new Error("Invalid token payload");
    return { userId, sessionId };
  } catch {
    throw new HttpError(401, "Invalid or expired access token");
  }
}

/**
 * REFRESH TOKEN:
 * payload: { sid: sessionId }
 * Note: refreshToken is stored in cookie httpOnly
 */
export function signRefreshToken(sessionId: string) {
  const opts: SignOptions = { expiresIn: env.REFRESH_TOKEN_TTL as any };
  return jwt.sign({ sid: sessionId }, env.JWT_REFRESH_SECRET, opts);
}

export async function ensureEmailNotRegistered(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new HttpError(409, "Email already registered");
  return email;
}

export async function requestRegisterVerificationCode(input: { email: string }) {
  const email = await ensureEmailNotRegistered(input.email);

  const now = new Date();
  const nowMs = now.getTime();
  const hourAgoMs = nowMs - 60 * 60 * 1000;

  const existing = await findVerificationCodeByEmail(email);
  let withinHour = false;

  if (existing) {
    const rawLastSentAtMs = existing.lastSentAt.getTime();
    const lastSentAtMs = Number.isFinite(rawLastSentAtMs) ? rawLastSentAtMs : 0;
    const skewedFutureMs = lastSentAtMs - nowMs;

    // If DB timestamp is too far in the future (timezone/clock issue), ignore cooldown.
    const effectiveLastSentAtMs =
      skewedFutureMs > ALLOWED_CLOCK_SKEW_MS
        ? nowMs - REGISTER_CODE_RESEND_COOLDOWN_MS - 1
        : lastSentAtMs;

    const resendAtMs = effectiveLastSentAtMs + REGISTER_CODE_RESEND_COOLDOWN_MS;
    if (resendAtMs > nowMs) {
      const waitSec = Math.max(1, Math.ceil((resendAtMs - nowMs) / 1000));
      throw new HttpError(429, `Tunggu ${waitSec} detik sebelum kirim ulang kode.`);
    }

    withinHour = effectiveLastSentAtMs <= nowMs && effectiveLastSentAtMs >= hourAgoMs;
    if (withinHour && existing.sendCount >= REGISTER_CODE_MAX_SEND_PER_HOUR) {
      throw new HttpError(
        429,
        "Batas kirim kode tercapai. Coba lagi dalam beberapa saat.",
      );
    }
  }

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(nowMs + REGISTER_CODE_TTL_MS);
  const sendCount = existing && withinHour ? existing.sendCount + 1 : 1;

  await upsertVerificationCodeRow({
    email,
    codeHash,
    expiresAt,
    sendCount,
    lastSentAt: now,
  });

  try {
    await sendRegisterVerificationCodeEmail({
      to: email,
      code,
      expiresInMinutes: Math.floor(REGISTER_CODE_TTL_MS / 60_000),
    });
  } catch (err) {
    await deleteVerificationCode(email).catch(() => undefined);
    throw err;
  }

  return {
    resendInSec: Math.floor(REGISTER_CODE_RESEND_COOLDOWN_MS / 1000),
    expiresInSec: Math.floor(REGISTER_CODE_TTL_MS / 1000),
  };
}

export async function consumeRegisterVerificationCode(input: {
  email: string;
  verificationCode: string;
}) {
  const email = normalizeEmail(input.email);
  const verificationCode = normalizeVerificationCode(input.verificationCode);

  if (verificationCode.length !== REGISTER_CODE_LENGTH) {
    throw new HttpError(400, "Kode verifikasi harus 6 digit.");
  }

  const row = await findVerificationCodeByEmail(email);

  if (!row) throw new HttpError(400, "Kode verifikasi belum diminta.");

  if (row.expiresAt.getTime() < Date.now()) {
    await deleteVerificationCode(email).catch(() => undefined);
    throw new HttpError(400, "Kode verifikasi sudah kadaluarsa. Silakan kirim ulang.");
  }

  if (row.attemptCount >= REGISTER_CODE_MAX_ATTEMPT) {
    throw new HttpError(429, "Terlalu banyak percobaan kode. Silakan kirim ulang.");
  }

  const ok = await bcrypt.compare(verificationCode, row.codeHash);
  if (!ok) {
    await incrementVerificationAttempt(email);
    throw new HttpError(400, "Kode verifikasi tidak valid.");
  }

  await deleteVerificationCode(email);
}

export async function requestPasswordResetLink(input: { email: string }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const now = new Date();
  const nowMs = now.getTime();
  const hourAgoMs = nowMs - 60 * 60 * 1000;

  const existing = await findPasswordResetCodeByEmail(email);
  let withinHour = false;

  if (existing) {
    const rawLastSentAtMs = existing.lastSentAt.getTime();
    const lastSentAtMs = Number.isFinite(rawLastSentAtMs) ? rawLastSentAtMs : 0;
    const skewedFutureMs = lastSentAtMs - nowMs;

    const effectiveLastSentAtMs =
      skewedFutureMs > ALLOWED_CLOCK_SKEW_MS
        ? nowMs - PASSWORD_RESET_LINK_RESEND_COOLDOWN_MS - 1
        : lastSentAtMs;

    const resendAtMs = effectiveLastSentAtMs + PASSWORD_RESET_LINK_RESEND_COOLDOWN_MS;
    if (resendAtMs > nowMs) {
      const waitSec = Math.max(1, Math.ceil((resendAtMs - nowMs) / 1000));
      throw new HttpError(429, `Tunggu ${waitSec} detik sebelum kirim ulang link.`);
    }

    withinHour = effectiveLastSentAtMs <= nowMs && effectiveLastSentAtMs >= hourAgoMs;
    if (withinHour && existing.sendCount >= PASSWORD_RESET_LINK_MAX_SEND_PER_HOUR) {
      throw new HttpError(
        429,
        "Batas kirim link tercapai. Coba lagi dalam beberapa saat.",
      );
    }
  }

  const token = generatePasswordResetToken();
  const codeHash = hashPasswordResetToken(token);
  const expiresAt = new Date(nowMs + PASSWORD_RESET_LINK_TTL_MS);
  const sendCount = existing && withinHour ? existing.sendCount + 1 : 1;

  await upsertPasswordResetCodeRow({
    email,
    codeHash,
    expiresAt,
    sendCount,
    lastSentAt: now,
  });

  if (!user) {
    return {
      resendInSec: Math.floor(PASSWORD_RESET_LINK_RESEND_COOLDOWN_MS / 1000),
      expiresInSec: Math.floor(PASSWORD_RESET_LINK_TTL_MS / 1000),
    };
  }

  try {
    await sendPasswordResetLinkEmail({
      to: email,
      resetUrl: buildPasswordResetUrl(token),
      expiresInMinutes: Math.floor(PASSWORD_RESET_LINK_TTL_MS / 60_000),
    });
  } catch (err) {
    await deletePasswordResetCode(email).catch(() => undefined);
    throw err;
  }

  return {
    resendInSec: Math.floor(PASSWORD_RESET_LINK_RESEND_COOLDOWN_MS / 1000),
    expiresInSec: Math.floor(PASSWORD_RESET_LINK_TTL_MS / 1000),
  };
}

async function findValidPasswordResetByToken(tokenInput: string) {
  const token = String(tokenInput ?? "").trim();
  if (token.length !== 64) {
    throw new HttpError(404, "Link reset password tidak ditemukan.");
  }

  const row = await findPasswordResetCodeByTokenHash(hashPasswordResetToken(token));
  if (!row) throw new HttpError(404, "Link reset password tidak ditemukan.");
  if (row.expiresAt.getTime() < Date.now()) {
    await deletePasswordResetCode(row.email).catch(() => undefined);
    throw new HttpError(404, "Link reset password tidak ditemukan.");
  }

  return row;
}

export async function ensurePasswordResetLinkValid(token: string) {
  await findValidPasswordResetByToken(token);
}

export async function resetPasswordWithLink(input: {
  token: string;
  newPassword: string;
}) {
  const resetRow = await findValidPasswordResetByToken(input.token);

  const user = await prisma.user.findUnique({
    where: { email: resetRow.email },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    await deletePasswordResetCode(resetRow.email).catch(() => undefined);
    throw new HttpError(404, "Link reset password tidak ditemukan.");
  }

  const sameAsOld = await bcrypt.compare(input.newPassword, user.passwordHash);
  if (sameAsOld) {
    throw new HttpError(400, "Password baru harus berbeda dari password lama.");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await prisma.session.updateMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  await deletePasswordResetCode(resetRow.email);
}

export async function register(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const email = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "Email already registered");

  // bcrypt max safe password length is 72 chars (we already enforce via zod)
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: normalizeName(input.name),
    },
    select: {
      id: true,
      email: true,
      name: true,
      balance: true,
      createdAt: true,
    },
  });

  return user;
}

export async function login(
  input: { email: string; password: string },
  meta: { userAgent?: string; ip?: string },
) {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(401, "Invalid credentials");

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid credentials");

  // Create a DB session (remember device)
  const expiresAt = new Date(Date.now() + ttlToMs(env.REFRESH_TOKEN_TTL));

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: "temp", // updated after token created
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt,
    },
    select: { id: true },
  });

  // Issue refresh token then store its hash (never store raw refresh token in DB)
  const refreshToken = signRefreshToken(session.id);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash },
  });

  // Issue access token that includes both userId + sessionId
  const accessToken = signAccessToken(user.id, session.id);

  return {
    user: { id: user.id, email: user.email, name: user.name, balance: user.balance },
    accessToken,
    refreshToken,
    sessionId: session.id,
  };
}

export async function refresh(
  oldRefreshToken: string,
  meta: { userAgent?: string; ip?: string },
) {
  let payload: any;
  try {
    payload = jwt.verify(oldRefreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new HttpError(401, "Invalid refresh token");
  }

  const sessionId = payload?.sid as string | undefined;
  if (!sessionId) throw new HttpError(401, "Invalid refresh token");

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) throw new HttpError(401, "Session not found");
  if (session.revokedAt) throw new HttpError(401, "Session revoked");
  if (session.expiresAt.getTime() < Date.now())
    throw new HttpError(401, "Session expired");

  // Compare refresh token against stored hash
  const ok = await bcrypt.compare(oldRefreshToken, session.refreshTokenHash);
  if (!ok) {
    // Token mismatch => likely stolen token => revoke session
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    throw new HttpError(401, "Refresh token mismatch");
  }

  // ROTATE refresh token
  const newRefreshToken = signRefreshToken(session.id);
  const newHash = await bcrypt.hash(newRefreshToken, 12);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });

  // New access token
  const accessToken = signAccessToken(session.userId, session.id);

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      balance: session.user.balance,
    },
    accessToken,
    refreshToken: newRefreshToken,
    sessionId: session.id,
  };
}

/**
 * Revoke a session based on the refresh token (e.g., logout).
 * Safe to call even if token invalid.
 */
export async function revokeSessionByRefreshToken(refreshToken: string) {
  try {
    const payload: any = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const sid = payload?.sid as string | undefined;
    if (!sid) return;

    await prisma.session.update({
      where: { id: sid },
      data: { revokedAt: new Date() },
    });
  } catch {
    // ignore invalid token
  }
}

/**
 * Optional helper: revoke session by id (for session management endpoints).
 */
export async function revokeSessionById(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId)
    throw new HttpError(404, "Session not found");

  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}
