import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/errors";
import { CSRF_HEADER_NAME } from "../utils/csrf";
import { ADMIN_CSRF_COOKIE_NAME } from "../utils/adminCookies";

export function requireAdminCsrf(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const csrfCookie = req.cookies?.[ADMIN_CSRF_COOKIE_NAME];
  const csrfHeader = req.get(CSRF_HEADER_NAME);

  if (!csrfCookie || !csrfHeader) {
    return next(new HttpError(403, "CSRF token missing"));
  }
  if (csrfCookie !== csrfHeader) {
    return next(new HttpError(403, "CSRF token invalid"));
  }
  next();
}
