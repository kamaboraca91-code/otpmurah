import { Router } from "express";
import { requireAuth } from "../middleware/requireUserAuth";
import { prisma } from "../prisma";
import {
  cancelNumberOrderForUser,
  completeNumberOrderForUser,
  syncNumberOrderForUser,
  toNumberOrderDto,
} from "../modules/numbers/numberOrders.service";
import { subscribeNumberEvents } from "../modules/numbers/numbersRealtime";
import { HttpError } from "../utils/errors";

export const numbersRoutes = Router();

numbersRoutes.get("/", requireAuth, async (req, res) => {
  const [items, user] = await Promise.all([
    prisma.userNumberOrder.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findUnique({
      where: { id: req.userId! },
      select: { balance: true },
    }),
  ]);

  return res.json({
    ok: true,
    balance: user?.balance ?? 0,
    items: items.map(toNumberOrderDto),
  });
});

numbersRoutes.get("/stream", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send("ready", { ok: true, ts: Date.now() });

  const unsubscribe = subscribeNumberEvents(req.userId!, (event) => {
    send("number_update", event);
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

numbersRoutes.post("/:id/sync", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing order id");
    const item = await syncNumberOrderForUser(req.userId!, id);
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { balance: true },
    });

    return res.json({
      ok: true,
      item: toNumberOrderDto(item),
      balance: user?.balance ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

numbersRoutes.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing order id");
    const item = await cancelNumberOrderForUser(req.userId!, id);
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { balance: true },
    });

    return res.json({
      ok: true,
      item: toNumberOrderDto(item),
      balance: user?.balance ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

numbersRoutes.post("/:id/complete", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing order id");
    const item = await completeNumberOrderForUser(req.userId!, id);

    return res.json({
      ok: true,
      item: toNumberOrderDto(item),
    });
  } catch (err) {
    next(err);
  }
});
