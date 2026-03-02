import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/errors";
import { CSRF_COOKIE_NAME } from "../utils/userCookies";
import { CSRF_HEADER_NAME } from "../utils/csrf";

export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
  const csrfHeader = req.get(CSRF_HEADER_NAME);

  if (!csrfCookie || !csrfHeader) {
    return next(new HttpError(403, "CSRF token missing"));
  }
  if (csrfCookie !== csrfHeader) {
    return next(new HttpError(403, "CSRF token invalid"));
  }
  next();
}
