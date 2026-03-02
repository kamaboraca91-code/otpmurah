import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/errors";
import { ADMIN_ACCESS_COOKIE_NAME } from "../utils/adminCookies";
import { verifyAdminAccessToken } from "../modules/admin/adminAuth.service";

export function requireAdminAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.get("authorization");
  const cookieToken = req.cookies?.[ADMIN_ACCESS_COOKIE_NAME];

  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : cookieToken;

  if (!token) return next(new HttpError(401, "Missing admin access token"));

  const { adminId, sessionId } = verifyAdminAccessToken(token);

  (req as any).adminId = adminId;
  (req as any).adminSessionId = sessionId;

  next();
}
