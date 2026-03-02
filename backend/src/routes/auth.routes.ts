import { Router } from "express";
import * as c from "../modules/users/auth.controller";
import {
  loginLimiter,
  passwordResetCodeEmailLimiter,
  passwordResetCodeLimiter,
  passwordResetSubmitLimiter,
  refreshLimiter,
  registerCodeLimiter,
  registerCodeEmailLimiter,
  registerSubmitLimiter,
} from "../middleware/rateLimiters";
import { requireCsrf } from "../middleware/requireUserCsrf";
import { requireSameOrigin, requireStrictSameOrigin } from "../middleware/requireSameOrigin";

export const authRoutes = Router();

authRoutes.post(
  "/register/request-code",
  requireStrictSameOrigin,
  registerCodeLimiter,
  registerCodeEmailLimiter,
  c.requestRegisterCode,
);
authRoutes.post(
  "/register",
  requireStrictSameOrigin,
  registerSubmitLimiter,
  c.register,
);
authRoutes.post(
  "/password/request-link",
  requireStrictSameOrigin,
  passwordResetCodeLimiter,
  passwordResetCodeEmailLimiter,
  c.requestPasswordResetLink,
);
authRoutes.post(
  "/password/validate-link",
  requireStrictSameOrigin,
  passwordResetSubmitLimiter,
  c.validatePasswordResetLink,
);
authRoutes.post(
  "/password/reset-link",
  requireStrictSameOrigin,
  passwordResetSubmitLimiter,
  c.resetPasswordByLink,
);
authRoutes.post("/login", loginLimiter, c.login);

// refresh: rate-limit + origin check + csrf check
authRoutes.post(
  "/refresh",
  refreshLimiter,
  requireSameOrigin,
  requireCsrf,
  c.refresh,
);

authRoutes.post("/logout", c.logout);
