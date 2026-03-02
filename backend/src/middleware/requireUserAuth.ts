import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../modules/users/auth.service";
import { HttpError } from "../utils/errors";
import { ACCESS_COOKIE_NAME } from "../utils/userCookies";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.get("authorization");

  let token: string | undefined;

  // 1) Bearer token (optional support)
  if (header?.startsWith("Bearer ")) {
    token = header.slice("Bearer ".length).trim();
  }

  // 2) Cookie access token (recommended)
  if (!token) {
    token = req.cookies?.[ACCESS_COOKIE_NAME];
  }

  if (!token) return next(new HttpError(401, "Missing auth token"));

  try {
    const { userId, sessionId } = verifyAccessToken(token);
    req.userId = userId;
    req.sessionId = sessionId;
    return next();
  } catch (e: any) {
    return next(new HttpError(401, e?.message || "Invalid or expired token"));
  }
}
