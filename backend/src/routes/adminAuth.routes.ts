import { Router } from "express";
import * as c from "../modules/admin/adminAuth.controller";
import { loginLimiter, refreshLimiter } from "../middleware/rateLimiters";
import { requireAdminCsrf } from "../middleware/requireAdminCsrf";
import { requireSameOrigin } from "../middleware/requireSameOrigin";

export const adminAuthRoutes = Router();

adminAuthRoutes.get("/me", c.me);
adminAuthRoutes.post("/login", loginLimiter, c.login);
adminAuthRoutes.post(
  "/refresh",
  refreshLimiter,
  requireSameOrigin,
  requireAdminCsrf,
  c.refresh,
);
adminAuthRoutes.post("/logout", c.logout);
