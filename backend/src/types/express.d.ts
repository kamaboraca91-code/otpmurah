import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    sessionId?: string; // kalau kamu pakai multi-session
    adminId?: string;
    adminSessionId?: string;
  }
}
