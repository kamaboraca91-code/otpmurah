import { Router } from "express";
import { requireAuth } from "../middleware/requireUserAuth";
import { prisma } from "../prisma";
import { HttpError } from "../utils/errors";

export const sessionRoutes = Router();

sessionRoutes.get("/", requireAuth, async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.userId!, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return res.json({
    currentSessionId: req.sessionId,
    sessions,
  });
});

// revoke 1 session
sessionRoutes.delete("/:id", requireAuth, async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new HttpError(400, "Missing session id");

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || session.userId !== req.userId!)
    throw new HttpError(404, "Session not found");

  await prisma.session.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return res.json({ ok: true });
});

// revoke all except current
sessionRoutes.delete("/", requireAuth, async (req, res) => {
  await prisma.session.updateMany({
    where: {
      userId: req.userId!,
      revokedAt: null,
      NOT: { id: req.sessionId! },
    },
    data: { revokedAt: new Date() },
  });

  return res.json({ ok: true });
});
