import { Router } from "express";
import { env } from "../env";
import { applyWebhookUpdate } from "../modules/numbers/numberOrders.service";

export const herosmsWebhookRoutes = Router();

herosmsWebhookRoutes.all("/", async (req, res, next) => {
  try {
    const expectedSecret = env.HEROSMS_WEBHOOK_SECRET;
    if (expectedSecret) {
      const providedSecret = String(
        req.get("x-webhook-secret") ??
          req.query?.secret ??
          (typeof req.body === "object" && req.body ? (req.body as any).secret : "") ??
          "",
      );

      if (providedSecret !== expectedSecret) {
        return res.status(401).json({ ok: false, message: "Invalid webhook secret" });
      }
    }

    const payload: Record<string, unknown> = {
      ...(req.query as Record<string, unknown>),
    };

    let rawText: string | undefined;
    if (typeof req.body === "string") {
      rawText = req.body.trim() || undefined;
    } else if (req.body && typeof req.body === "object") {
      Object.assign(payload, req.body as Record<string, unknown>);
    }

    const updated = await applyWebhookUpdate(payload, rawText);

    return res.json({
      ok: true,
      updated: Boolean(updated),
    });
  } catch (err) {
    next(err);
  }
});
