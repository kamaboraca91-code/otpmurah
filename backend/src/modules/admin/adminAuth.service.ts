import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../../prisma";
import { env } from "../../env";
import { HttpError } from "../../utils/errors";

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
          : 86_400_000;
  return n * mult;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** payload: { sub: adminId, sid: adminSessionId } */
export function signAdminAccessToken(adminId: string, sessionId: string) {
  const opts: SignOptions = { expiresIn: env.ADMIN_ACCESS_TOKEN_TTL as any };
  return jwt.sign({ sub: adminId, sid: sessionId }, env.JWT_ADMIN_ACCESS_SECRET, opts);
}

export function verifyAdminAccessToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_ADMIN_ACCESS_SECRET) as any;
    const adminId = payload?.sub as string | undefined;
    const sessionId = payload?.sid as string | undefined;
    if (!adminId || !sessionId) throw new Error("Invalid token payload");
    return { adminId, sessionId };
  } catch {
    throw new HttpError(401, "Invalid or expired admin access token");
  }
}

/** payload: { sid: adminSessionId } */
export function signAdminRefreshToken(sessionId: string) {
  const opts: SignOptions = { expiresIn: env.ADMIN_REFRESH_TOKEN_TTL as any };
  return jwt.sign({ sid: sessionId }, env.JWT_ADMIN_REFRESH_SECRET, opts);
}

export async function login(
  input: { email: string; password: string },
  meta: { userAgent?: string; ip?: string },
) {
  const email = normalizeEmail(input.email);

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) throw new HttpError(401, "Invalid credentials");
  if (!admin.isActive) throw new HttpError(403, "Admin account disabled");

  const ok = await bcrypt.compare(input.password, admin.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid credentials");

  const expiresAt = new Date(Date.now() + ttlToMs(env.ADMIN_REFRESH_TOKEN_TTL));

  const session = await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      refreshTokenHash: "temp",
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt,
    },
    select: { id: true },
  });

  const refreshToken = signAdminRefreshToken(session.id);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

  await prisma.adminSession.update({
    where: { id: session.id },
    data: { refreshTokenHash },
  });

  const accessToken = signAdminAccessToken(admin.id, session.id);

  return {
    admin: { id: admin.id, email: admin.email, name: admin.name },
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
    payload = jwt.verify(oldRefreshToken, env.JWT_ADMIN_REFRESH_SECRET);
  } catch {
    throw new HttpError(401, "Invalid admin refresh token");
  }

  const sessionId = payload?.sid as string | undefined;
  if (!sessionId) throw new HttpError(401, "Invalid admin refresh token");

  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
    include: { admin: true },
  });

  if (!session) throw new HttpError(401, "Admin session not found");
  if (session.revokedAt) throw new HttpError(401, "Admin session revoked");
  if (session.expiresAt.getTime() < Date.now()) throw new HttpError(401, "Admin session expired");
  if (!session.admin.isActive) throw new HttpError(403, "Admin account disabled");

  const ok = await bcrypt.compare(oldRefreshToken, session.refreshTokenHash);
  if (!ok) {
    await prisma.adminSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    throw new HttpError(401, "Admin refresh token mismatch");
  }

  const newRefreshToken = signAdminRefreshToken(session.id);
  const newHash = await bcrypt.hash(newRefreshToken, 12);

  await prisma.adminSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });

  const accessToken = signAdminAccessToken(session.adminId, session.id);

  return {
    admin: { id: session.admin.id, email: session.admin.email, name: session.admin.name },
    accessToken,
    refreshToken: newRefreshToken,
    sessionId: session.id,
  };
}

export async function revokeSessionByRefreshToken(refreshToken: string) {
  try {
    const payload: any = jwt.verify(refreshToken, env.JWT_ADMIN_REFRESH_SECRET);
    const sid = payload?.sid as string | undefined;
    if (!sid) return;

    await prisma.adminSession.update({
      where: { id: sid },
      data: { revokedAt: new Date() },
    });
  } catch {
    // ignore
  }
}