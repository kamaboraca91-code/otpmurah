import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { env } from "./env";
import { authRoutes } from "./routes/auth.routes";
import { userRoutes } from "./routes/user.routes";
import { adminAuthRoutes } from "./routes/adminAuth.routes";
import { adminSettingsRoutes } from "./routes/adminSettings.routes";
import { adminServiceRoutes } from "./routes/adminService.routes";
import { adminMonitorRoutes } from "./routes/adminMonitor.routes";

import { HttpError } from "./utils/errors";
import { sessionRoutes } from "./routes/session.routes";
import herosmsRoutes from "./routes/herosms.routes";
import { numbersRoutes } from "./routes/numbers.routes";
import { herosmsWebhookRoutes } from "./routes/herosmsWebhook.routes";
import { myPgWebhookRoutes, topupsRoutes } from "./routes/topups.routes";
import { balanceMutationsRoutes } from "./routes/balanceMutations.routes";
import { newsRoutes } from "./routes/news.routes";
import { websiteRoutes } from "./routes/website.routes";

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(env.CORS_ORIGINS);

  app.set("trust proxy", 1);

  app.use(
    helmet({
      // Allow images/files in /uploads to be used by frontend on different origin (e.g. :5173 -> :4000)
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use("/auth", authRoutes);
  app.use("/user", userRoutes);
  app.use("/admin/auth", adminAuthRoutes);
  app.use("/admin/settings", adminSettingsRoutes);
  app.use("/admin/services", adminServiceRoutes);
  app.use("/admin/monitor", adminMonitorRoutes);

  app.use("/sessions", sessionRoutes);
  app.use("/api/herosms", herosmsRoutes);
  app.use("/api/numbers", numbersRoutes);
  app.use("/api/topups", topupsRoutes);
  app.use("/api/balance-mutations", balanceMutationsRoutes);
  app.use("/api/news", newsRoutes);
  app.use("/api/website", websiteRoutes);
  app.use("/webhooks/herosms", herosmsWebhookRoutes);
  app.use("/webhooks/mypg", myPgWebhookRoutes);
  app.use("/webhooks/tokopay", myPgWebhookRoutes);
  // error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err instanceof HttpError ? err.status : (err?.status ?? 500);
    const message = err?.message ?? "Internal Server Error";
    res.status(status).json({ message });
  });

  return app;
}
