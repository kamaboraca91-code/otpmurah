import crypto from "crypto";

export const CSRF_COOKIE_NAME = "csrfToken";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}