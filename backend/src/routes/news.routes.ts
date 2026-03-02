import { Router } from "express";
import { requireAuth } from "../middleware/requireUserAuth";
import { prisma } from "../prisma";

export const newsRoutes = Router();

function toInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

newsRoutes.get("/", requireAuth, async (req, res) => {
  const limit = Math.min(20, Math.max(1, toInt(req.query.limit, 8)));
  const q = String(req.query.q ?? "").trim();

  const items = await prisma.newsInfo.findMany({
    where: {
      isPublished: true,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
              { tag: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      tag: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.json({ items });
});
