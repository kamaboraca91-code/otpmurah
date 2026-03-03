import { Router } from "express";
import { requireAuth } from "../middleware/requireUserAuth";
import { prisma } from "../prisma";
import {
  applyMyPgWebhook,
  cancelTopupForUser,
  createTopupForUser,
  expirePendingTopupsForUser,
  syncTopupStatusForUser,
  toTopupDto,
} from "../modules/topups/topup.service";
import { subscribeTopupEvents } from "../modules/topups/topupRealtime";
import { verifyMyPgWebhookPayload } from "../modules/topups/mypg.client";
import { env } from "../env";
import { HttpError } from "../utils/errors";

export const topupsRoutes = Router();
export const myPgWebhookRoutes = Router();

topupsRoutes.get("/", requireAuth, async (req, res) => {
  await expirePendingTopupsForUser(req.userId!);

  const [items, user] = await Promise.all([
    prisma.userTopup.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.findUnique({
      where: { id: req.userId! },
      select: { balance: true },
    }),
  ]);

  return res.json({
    ok: true,
    balance: user?.balance ?? 0,
    items: items.map(toTopupDto),
  });
});

topupsRoutes.post("/", requireAuth, async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);
    const methodCode = String(req.body?.methodCode ?? "").trim();

    const item = await createTopupForUser({
      userId: req.userId!,
      amount,
      methodCode,
    });

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { balance: true },
    });

    return res.json({ ok: true, item, balance: user?.balance ?? 0 });
  } catch (err) {
    next(err);
  }
});

topupsRoutes.post("/:id/sync", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing topup id");

    const item = await syncTopupStatusForUser(req.userId!, id);
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { balance: true },
    });

    return res.json({ ok: true, item, balance: user?.balance ?? 0 });
  } catch (err) {
    next(err);
  }
});

topupsRoutes.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing topup id");

    const item = await cancelTopupForUser(req.userId!, id);
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { balance: true },
    });

    return res.json({ ok: true, item, balance: user?.balance ?? 0 });
  } catch (err) {
    next(err);
  }
});

topupsRoutes.get("/stream", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send("ready", { ok: true, ts: Date.now() });

  const unsubscribe = subscribeTopupEvents(req.userId!, (event) => {
    send("topup_update", event);
  });

  void expirePendingTopupsForUser(req.userId!).catch(() => {
    /* ignore expiring errors inside SSE channel */
  });

  const heartbeat = setInterval(() => {
    send("ping", { ts: Date.now() });
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

myPgWebhookRoutes.all("/", async (req, res, next) => {
  try {
    const payload: Record<string, unknown> = {
      ...(req.query as Record<string, unknown>),
      ...(typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {}),
    };

    const callbackSecret = env.MYPG_CALLBACK_SECRET.trim();
    if (callbackSecret) {
      const providedSecret = String(
        req.get("x-callback-secret") ??
          req.get("x-webhook-secret") ??
          payload.callback_secret ??
          payload.secret ??
          "",
      ).trim();
      if (providedSecret !== callbackSecret) {
        return res.status(401).json({ status: false, message: "Invalid callback secret" });
      }
    }

    const sourceOk = verifyMyPgWebhookPayload(payload);
    if (!sourceOk) {
      return res.status(401).json({ status: false, message: "Invalid webhook payload" });
    }

    await applyMyPgWebhook(payload);
    return res.json({ status: true, message: "OK" });
  } catch (err) {
    next(err);
  }
});
