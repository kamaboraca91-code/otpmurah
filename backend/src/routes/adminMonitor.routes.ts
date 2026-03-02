import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import { prisma } from "../prisma";
import { HttpError } from "../utils/errors";
import { applyBalanceMutationTx } from "../modules/balance/balanceMutations.service";

export const adminMonitorRoutes = Router();

function toInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value: unknown) {
  const x = String(value ?? "").trim();
  return x || null;
}

function validatePassword(value: string) {
  if (value.length < 10) {
    throw new HttpError(400, "Password minimal 10 karakter");
  }
  if (value.length > 72) {
    throw new HttpError(400, "Password maksimal 72 karakter");
  }
  if (!/[a-z]/.test(value)) {
    throw new HttpError(400, "Password harus ada huruf kecil");
  }
  if (!/[A-Z]/.test(value)) {
    throw new HttpError(400, "Password harus ada huruf besar");
  }
  if (!/\d/.test(value)) {
    throw new HttpError(400, "Password harus ada angka");
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    throw new HttpError(400, "Password harus ada simbol");
  }
}

function buildOrderStatusWhere(statusRaw: unknown): Prisma.UserNumberOrderWhereInput | null {
  const status = String(statusRaw ?? "ALL").trim().toUpperCase();
  if (!status || status === "ALL") return null;

  if (status === "SUCCESS") {
    return {
      OR: [{ status: "STATUS_OK" }, { status: "STATUS_COMPLETED" }],
    };
  }

  if (status === "WAITING") {
    return {
      status: { contains: "WAIT", mode: "insensitive" },
    };
  }

  if (status === "CANCELED" || status === "ERROR") {
    return {
      OR: [
        { status: { contains: "CANCEL", mode: "insensitive" } },
        { status: { contains: "TIMEOUT", mode: "insensitive" } },
        { status: { contains: "FAILED", mode: "insensitive" } },
        { status: { contains: "ERROR", mode: "insensitive" } },
      ],
    };
  }

  return {
    status,
  };
}

adminMonitorRoutes.get("/overview", requireAdminAuth, async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(7, toInt(req.query.days, 14)));
    const now = new Date();
    const startAt = new Date(now);
    startAt.setHours(0, 0, 0, 0);
    startAt.setDate(startAt.getDate() - (days - 1));

    const [
      totalUsers,
      totalOrders,
      totalOrderSuccess,
      totalOrderWaiting,
      totalOrderError,
      totalTopups,
      totalTopupPending,
      totalTopupPaid,
      totalBalanceAgg,
      totalOrderAmountAgg,
      totalProfitAgg,
      totalTopupAmountAgg,
      recentOrdersRaw,
      recentTopupsRaw,
      ordersInWindow,
      paidTopupsInWindow,
      refundsInWindow,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userNumberOrder.count(),
      prisma.userNumberOrder.count({
        where: {
          OR: [{ status: "STATUS_OK" }, { status: "STATUS_COMPLETED" }],
        },
      }),
      prisma.userNumberOrder.count({
        where: { status: { contains: "WAIT", mode: "insensitive" } },
      }),
      prisma.userNumberOrder.count({
        where: {
          OR: [
            { status: { contains: "CANCEL", mode: "insensitive" } },
            { status: { contains: "TIMEOUT", mode: "insensitive" } },
            { status: { contains: "FAILED", mode: "insensitive" } },
            { status: { contains: "ERROR", mode: "insensitive" } },
          ],
        },
      }),
      prisma.userTopup.count(),
      prisma.userTopup.count({ where: { status: "PENDING" } }),
      prisma.userTopup.count({ where: { status: "PAID" } }),
      prisma.user.aggregate({
        _sum: { balance: true },
      }),
      prisma.userNumberOrder.aggregate({
        _sum: { pricePaid: true },
      }),
      prisma.userNumberOrder.aggregate({
        _sum: { profitAmount: true },
      }),
      prisma.userTopup.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.userNumberOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          activationId: true,
          service: true,
          serviceName: true,
          country: true,
          countryName: true,
          phoneNumber: true,
          pricePaid: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.userTopup.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          reffId: true,
          amount: true,
          status: true,
          methodCode: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.userNumberOrder.findMany({
        where: { createdAt: { gte: startAt } },
        select: {
          createdAt: true,
          pricePaid: true,
          profitAmount: true,
        },
      }),
      prisma.userTopup.findMany({
        where: {
          status: "PAID",
          createdAt: { gte: startAt },
        },
        select: {
          createdAt: true,
          amount: true,
        },
      }),
      prisma.userBalanceMutation.findMany({
        where: {
          type: "ORDER_REFUND",
          createdAt: { gte: startAt },
        },
        select: {
          createdAt: true,
          amount: true,
        },
      }),
    ]);

    const timeline = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(startAt);
      d.setDate(startAt.getDate() + idx);
      return {
        key: dayKey(d),
        label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        orderCount: 0,
        depositCount: 0,
        orderAmount: 0,
        depositAmount: 0,
        refundAmount: 0,
        netProfit: 0,
      };
    });

    const byKey = new Map(timeline.map((x) => [x.key, x]));

    for (const row of ordersInWindow) {
      const key = dayKey(new Date(row.createdAt));
      const item = byKey.get(key);
      if (!item) continue;
      item.orderCount += 1;
      item.orderAmount += Number(row.pricePaid ?? 0);
      item.netProfit += Number(row.profitAmount ?? 0);
    }

    for (const row of paidTopupsInWindow) {
      const key = dayKey(new Date(row.createdAt));
      const item = byKey.get(key);
      if (!item) continue;
      item.depositCount += 1;
      item.depositAmount += Number(row.amount ?? 0);
    }

    for (const row of refundsInWindow) {
      const key = dayKey(new Date(row.createdAt));
      const item = byKey.get(key);
      if (!item) continue;
      item.refundAmount += Number(row.amount ?? 0);
    }

    for (const item of timeline) {
      item.netProfit = Number(item.netProfit ?? 0);
    }

    const recentOrders = recentOrdersRaw;
    const recentTopups = recentTopupsRaw;

    return res.json({
      ok: true,
      summary: {
        totalUsers,
        totalOrders,
        totalOrderSuccess,
        totalOrderWaiting,
        totalOrderError,
        totalTopups,
        totalTopupPending,
        totalTopupPaid,
        totalBalance: Number(totalBalanceAgg._sum.balance ?? 0),
        totalOrderAmount: Number(totalOrderAmountAgg._sum.pricePaid ?? 0),
        totalProfit: Number(totalProfitAgg._sum.profitAmount ?? 0),
        totalTopupAmount: Number(totalTopupAmountAgg._sum.amount ?? 0),
      },
      analytics: {
        days,
        timeline,
      },
      recentOrders,
      recentTopups,
    });
  } catch (err) {
    next(err);
  }
});

adminMonitorRoutes.get("/orders", requireAdminAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(5, toInt(req.query.pageSize, 20)));
    const query = String(req.query.q ?? "").trim();

    const statusWhere = buildOrderStatusWhere(req.query.status);
    const queryWhere: Prisma.UserNumberOrderWhereInput | null = query
      ? {
          OR: [
            { activationId: { contains: query, mode: "insensitive" } },
            { phoneNumber: { contains: query, mode: "insensitive" } },
            { service: { contains: query, mode: "insensitive" } },
            { serviceName: { contains: query, mode: "insensitive" } },
            { countryName: { contains: query, mode: "insensitive" } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { user: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : null;

    const where: Prisma.UserNumberOrderWhereInput =
      statusWhere && queryWhere
        ? { AND: [statusWhere, queryWhere] }
        : statusWhere || queryWhere || {};

    const [totalItems, items] = await Promise.all([
      prisma.userNumberOrder.count({ where }),
      prisma.userNumberOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          activationId: true,
          service: true,
          serviceName: true,
          country: true,
          countryName: true,
          phoneNumber: true,
          pricePaid: true,
          status: true,
          smsCode: true,
          createdAt: true,
          updatedAt: true,
          refundedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return res.json({
      ok: true,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      items,
    });
  } catch (err) {
    next(err);
  }
});

adminMonitorRoutes.get("/users", requireAdminAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(5, toInt(req.query.pageSize, 20)));
    const query = String(req.query.q ?? "").trim();

    const where: Prisma.UserWhereInput = query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : {};

    const [totalItems, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          balance: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const userIds = users.map((x) => x.id);
    const [orderAgg, topupAgg] = userIds.length
      ? await Promise.all([
          prisma.userNumberOrder.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds } },
            _count: { _all: true },
            _sum: { pricePaid: true },
            _max: { createdAt: true },
          }),
          prisma.userTopup.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds } },
            _count: { _all: true },
            _sum: { amount: true },
            _max: { createdAt: true },
          }),
        ])
      : [[], []];

    const orderMap = new Map(orderAgg.map((x) => [x.userId, x]));
    const topupMap = new Map(topupAgg.map((x) => [x.userId, x]));

    const items = users.map((u) => {
      const oa = orderMap.get(u.id);
      const ta = topupMap.get(u.id);
      return {
        ...u,
        orderCount: Number(oa?._count?._all ?? 0),
        topupCount: Number(ta?._count?._all ?? 0),
        totalSpent: Number(oa?._sum?.pricePaid ?? 0),
        totalTopup: Number(ta?._sum?.amount ?? 0),
        lastOrderAt: oa?._max?.createdAt ?? null,
        lastTopupAt: ta?._max?.createdAt ?? null,
      };
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return res.json({
      ok: true,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      items,
    });
  } catch (err) {
    next(err);
  }
});

adminMonitorRoutes.post("/users", requireAdminAuth, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const name = normalizeName(req.body?.name);
    const password = String(req.body?.password ?? "");
    const initialBalance = Math.max(0, toInt(req.body?.balance, 0));

    if (!email || !email.includes("@")) {
      throw new HttpError(400, "Email tidak valid");
    }
    if (!password) {
      throw new HttpError(400, "Password wajib diisi");
    }
    validatePassword(password);

    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) {
      throw new HttpError(409, "Email sudah terdaftar");
    }

    const created = await prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          balance: 0,
        },
      });

      if (initialBalance > 0) {
        await applyBalanceMutationTx(tx, {
          userId: user.id,
          direction: "CREDIT",
          amount: initialBalance,
          type: "MANUAL_ADJUST",
          referenceType: "ADMIN_USER",
          referenceId: user.id,
          description: "Adjust saldo awal oleh admin",
          metadata: {
            adminId: req.adminId,
            source: "admin_create_user",
          },
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          balance: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return res.json({
      ok: true,
      item: created,
    });
  } catch (err) {
    next(err);
  }
});

adminMonitorRoutes.put("/users/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing user id");

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, balance: true },
    });
    if (!user) throw new HttpError(404, "User tidak ditemukan");

    const emailRaw = req.body?.email;
    const nameRaw = req.body?.name;
    const passwordRaw = req.body?.password;
    const balanceRaw = req.body?.balance;

    const nextEmail = emailRaw === undefined ? undefined : normalizeEmail(emailRaw);
    const nextName = nameRaw === undefined ? undefined : normalizeName(nameRaw);
    const nextPassword = passwordRaw === undefined ? undefined : String(passwordRaw ?? "");
    const nextBalance = balanceRaw === undefined ? undefined : Math.max(0, toInt(balanceRaw, user.balance));

    if (nextEmail !== undefined) {
      if (!nextEmail || !nextEmail.includes("@")) {
        throw new HttpError(400, "Email tidak valid");
      }
      if (nextEmail !== user.email) {
        const exists = await prisma.user.findUnique({
          where: { email: nextEmail },
          select: { id: true },
        });
        if (exists && exists.id !== id) {
          throw new HttpError(409, "Email sudah digunakan user lain");
        }
      }
    }

    if (nextPassword !== undefined && nextPassword) {
      validatePassword(nextPassword);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const patch: Prisma.UserUpdateInput = {};
      if (nextEmail !== undefined) patch.email = nextEmail;
      if (nextName !== undefined) patch.name = nextName;
      if (nextPassword) {
        patch.passwordHash = await bcrypt.hash(nextPassword, 12);
      }

      if (Object.keys(patch).length > 0) {
        await tx.user.update({
          where: { id },
          data: patch,
        });
      }

      if (nextBalance !== undefined && nextBalance !== user.balance) {
        const delta = Math.abs(nextBalance - user.balance);
        if (delta > 0) {
          await applyBalanceMutationTx(tx, {
            userId: id,
            direction: nextBalance > user.balance ? "CREDIT" : "DEBIT",
            amount: delta,
            type: "MANUAL_ADJUST",
            referenceType: "ADMIN_USER",
            referenceId: id,
            description: "Adjust saldo oleh admin",
            metadata: {
              adminId: req.adminId,
              source: "admin_update_user",
              previousBalance: user.balance,
              nextBalance,
            },
          });
        }
      }

      return tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          balance: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return res.json({
      ok: true,
      item: updated,
    });
  } catch (err) {
    next(err);
  }
});

adminMonitorRoutes.delete("/users/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing user id");

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new HttpError(404, "User tidak ditemukan");

    await prisma.user.delete({ where: { id } });

    return res.json({
      ok: true,
      item: user,
    });
  } catch (err) {
    next(err);
  }
});

function normalizeNewsText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeNewsTag(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function stripNewsHtml(value: string) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNewsPublished(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "true" || text === "1" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "no") return false;
  return false;
}

function validateNewsPayload(input: {
  title: string;
  summary: string;
  content: string;
  tag: string | null;
}) {
  const contentText = stripNewsHtml(input.content);

  if (!input.title) throw new HttpError(400, "Judul wajib diisi");
  if (input.title.length > 160) throw new HttpError(400, "Judul maksimal 160 karakter");
  if (!input.summary) throw new HttpError(400, "Ringkasan wajib diisi");
  if (input.summary.length > 300) throw new HttpError(400, "Ringkasan maksimal 300 karakter");
  if (!contentText) throw new HttpError(400, "Konten wajib diisi");
  if (input.content.length > 10000) throw new HttpError(400, "Konten maksimal 10000 karakter");
  if (input.tag && input.tag.length > 40) throw new HttpError(400, "Tag maksimal 40 karakter");
}

adminMonitorRoutes.get("/news", requireAdminAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(5, toInt(req.query.pageSize, 20)));
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "ALL").trim().toUpperCase();

    const where: Prisma.NewsInfoWhereInput = {
      ...(status === "PUBLISHED"
        ? { isPublished: true }
        : status === "DRAFT"
          ? { isPublished: false }
          : {}),
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
    };

    const [totalItems, items] = await Promise.all([
      prisma.newsInfo.count({ where }),
      prisma.newsInfo.findMany({
        where,
        orderBy: [{ isPublished: "desc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return res.json({
      ok: true,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      items,
    });
  } catch (err) {
    next(err);
  }
});

adminMonitorRoutes.post("/news", requireAdminAuth, async (req, res, next) => {
  try {
    const title = normalizeNewsText(req.body?.title);
    const summary = normalizeNewsText(req.body?.summary);
    const content = normalizeNewsText(req.body?.content);
    const tag = normalizeNewsTag(req.body?.tag);
    const isPublished = parseNewsPublished(req.body?.isPublished);

    validateNewsPayload({ title, summary, content, tag });

    const item = await prisma.newsInfo.create({
      data: {
        title,
        summary,
        content,
        tag,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        createdByAdminId: req.adminId ?? null,
        updatedByAdminId: req.adminId ?? null,
      },
    });

    return res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
});

adminMonitorRoutes.put("/news/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing news id");

    const existing = await prisma.newsInfo.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "News tidak ditemukan");

    const title = req.body?.title === undefined ? existing.title : normalizeNewsText(req.body?.title);
    const summary = req.body?.summary === undefined ? existing.summary : normalizeNewsText(req.body?.summary);
    const content = req.body?.content === undefined ? existing.content : normalizeNewsText(req.body?.content);
    const tag = req.body?.tag === undefined ? existing.tag : normalizeNewsTag(req.body?.tag);
    const nextPublished =
      req.body?.isPublished === undefined ? existing.isPublished : parseNewsPublished(req.body?.isPublished);

    validateNewsPayload({ title, summary, content, tag });

    let publishedAt: Date | null = existing.publishedAt;
    if (nextPublished && !existing.isPublished) {
      publishedAt = new Date();
    }
    if (!nextPublished) {
      publishedAt = null;
    }

    const item = await prisma.newsInfo.update({
      where: { id },
      data: {
        title,
        summary,
        content,
        tag,
        isPublished: nextPublished,
        publishedAt,
        updatedByAdminId: req.adminId ?? null,
      },
    });

    return res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
});

adminMonitorRoutes.delete("/news/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing news id");

    const exists = await prisma.newsInfo.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new HttpError(404, "News tidak ditemukan");

    await prisma.newsInfo.delete({ where: { id } });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
