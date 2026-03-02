import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/errors";
import { verifyAccessToken } from "../modules/users/auth.service";
import { verifyAdminAccessToken } from "../modules/admin/adminAuth.service";
import { ACCESS_COOKIE_NAME } from "../utils/userCookies";
import { ADMIN_ACCESS_COOKIE_NAME } from "../utils/adminCookies";

function normalizeBearer(header?: string) {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim();
}

export function requireUserOrAdminAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const bearerToken = normalizeBearer(req.get("authorization"));
  const userCookieToken = req.cookies?.[ACCESS_COOKIE_NAME];
  const adminCookieToken = req.cookies?.[ADMIN_ACCESS_COOKIE_NAME];

  const tokens = [bearerToken, userCookieToken, adminCookieToken].filter(
    (token): token is string => Boolean(token),
  );

  if (tokens.length === 0) {
    return next(new HttpError(401, "Missing auth token"));
  }

  for (const token of tokens) {
    try {
      const { userId, sessionId } = verifyAccessToken(token);
      req.userId = userId;
      req.sessionId = sessionId;
      return next();
    } catch {
      // try admin token if user verification fails
    }

    try {
      const { adminId, sessionId } = verifyAdminAccessToken(token);
      req.adminId = adminId;
      req.adminSessionId = sessionId;
      return next();
    } catch {
      // continue to next token candidate
    }
  }

  return next(new HttpError(401, "Invalid or expired token"));
}
