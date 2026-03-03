import { prisma } from "../../prisma";
import { HttpError } from "../../utils/errors";
import {
  myPgCheckOrderStatus,
  myPgCreateOrder,
} from "./mypg.client";
import { publishTopupEvent } from "./topupRealtime";
import { applyBalanceMutationTx } from "../balance/balanceMutations.service";

const userTopupFieldSet = new Set<string>(
  (((prisma as any)?._runtimeDataModel?.models?.UserTopup?.fields as
    | Array<{ name?: string }>
    | undefined) ?? [])
    .map((f) => String(f?.name ?? ""))
    .filter(Boolean),
);
const supportsTopupExpiredAt = userTopupFieldSet.has("expiredAt");

function toInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function randomRefPart() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeReffId(userId: string) {
  return `INV-${Date.now()}-${userId.slice(-6).toUpperCase()}-${randomRefPart()}`;
}

function parseTopupStatus(raw?: string) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "PENDING";
  if (["PAID", "SUCCESS", "COMPLETED", "BERHASIL"].includes(s)) return "PAID";
  if (["EXPIRED", "CANCELED", "CANCELLED", "FAILED", "ERROR"].includes(s))
    return "FAILED";
  return "PENDING";
}

function parseMaybeDate(input: unknown): Date | undefined {
  if (!input) return undefined;
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;

  if (typeof input === "number" && Number.isFinite(input)) {
    const ms = input > 1_000_000_000_000 ? input : input * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
    return undefined;
  }

  const raw = String(input).trim();
  if (!raw) return undefined;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Provider biasanya mengirim format "YYYY-MM-DD HH:mm:ss" tanpa timezone.
  const ymd = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (ymd) {
    const [, y, m, d, hh, mm, ss = "0"] = ymd;
    const utcMs = Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh) - 7, // asumsi WIB (UTC+7)
      Number(mm),
      Number(ss),
    );
    const parsed = new Date(utcMs);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const normalized = raw.includes(" ") && !raw.includes("T")
    ? raw.replace(" ", "T")
    : raw;
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;
  return undefined;
}

function applyExpiredStatus(input: {
  providerStatus: string;
  status: string;
  expiredAt?: Date | null;
}) {
  const providerStatus = String(input.providerStatus ?? "").trim() || "PENDING";
  const status = parseTopupStatus(input.status || providerStatus);
  const expiredAt = input.expiredAt ?? null;
  const isExpired = Boolean(
    status === "PENDING" &&
      expiredAt &&
      expiredAt.getTime() <= Date.now(),
  );

  return {
    providerStatus: isExpired ? "EXPIRED" : providerStatus,
    status: isExpired ? "FAILED" : status,
    expiredAt,
  };
}

export function toTopupDto(row: any) {
  return {
    id: row.id,
    reffId: row.reffId,
    methodCode: row.methodCode,
    amount: row.amount,
    totalBayar: row.totalBayar,
    totalDiterima: row.totalDiterima,
    providerRef: row.providerRef,
    providerTrxId: row.providerTrxId,
    providerStatus: row.providerStatus,
    status: row.status,
    payUrl: row.payUrl,
    checkoutUrl: row.checkoutUrl,
    qrLink: row.qrLink,
    qrString: row.qrString,
    nomorVa: row.nomorVa,
    panduanPembayaran: row.panduanPembayaran,
    paidAt: row.paidAt,
    creditedAt: row.creditedAt,
    expiredAt: supportsTopupExpiredAt ? row.expiredAt ?? null : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function creditIfPaid(topupId: string) {
  let credited = false;
  await prisma.$transaction(async (tx) => {
    const lock = await tx.userTopup.updateMany({
      where: {
        id: topupId,
        status: "PAID",
        creditedAt: null,
      },
      data: {
        creditedAt: new Date(),
        paidAt: new Date(),
      },
    });

    if (lock.count === 0) return;

    const topup = await tx.userTopup.findUnique({ where: { id: topupId } });
    if (!topup) return;

    await applyBalanceMutationTx(tx, {
      userId: topup.userId,
      direction: "CREDIT",
      amount: topup.amount,
      type: "TOPUP_CREDIT",
      referenceType: "TOPUP",
      referenceId: topup.id,
      description: `Topup saldo ${topup.reffId}`,
      metadata: {
        reffId: topup.reffId,
        methodCode: topup.methodCode,
      },
    });
    credited = true;
  });
  return credited;
}

function extractStatusData(res: any) {
  const data = res?.data && typeof res.data === "object" ? res.data : {};
  const providerStatusRaw = String(
    firstOf(data?.status ?? res?.status ?? "PENDING"),
  ).trim();
  const expiredAt = parseMaybeDate(
    firstOf(
      data?.expired_at ??
        data?.expiredAt ??
        data?.expires_at ??
        data?.expiresAt ??
        res?.expired_at ??
        res?.expiredAt ??
        res?.expires_at ??
        res?.expiresAt,
    ),
  );
  const normalized = applyExpiredStatus({
    providerStatus: providerStatusRaw,
    status: providerStatusRaw,
    expiredAt,
  });
  const directUrl = String(data?.direct_url ?? "").trim() || null;
  const qrisUrl = String(data?.qris_url ?? "").trim() || null;
  const qrisImage = String(data?.qris_image ?? "").trim() || null;

  return {
    providerStatus: normalized.providerStatus,
    status: normalized.status,
    expiredAt: normalized.expiredAt,
    providerRef: String(data?.order_id ?? "").trim() || null,
    providerTrxId: String(data?.signature ?? "").trim() || null,
    totalBayar: toInt(data?.total_amount ?? data?.amount_paid ?? data?.amount),
    totalDiterima: toInt(data?.amount_request ?? data?.amount),
    payUrl: directUrl,
    checkoutUrl: directUrl,
    qrLink: qrisUrl,
    qrString: qrisImage,
    nomorVa: null,
    panduanPembayaran: null,
  };
}

async function publishTopupUpdate(
  topupId: string,
  type: "created" | "updated" | "credited" | "canceled",
) {
  const [topup, user] = await Promise.all([
    prisma.userTopup.findUnique({ where: { id: topupId } }),
    prisma.userTopup
      .findUnique({ where: { id: topupId }, select: { userId: true } })
      .then(async (x) =>
        x
          ? prisma.user.findUnique({
              where: { id: x.userId },
              select: { balance: true },
            })
          : null,
      ),
  ]);

  if (!topup) return;
  publishTopupEvent(topup.userId, {
    type,
    item: toTopupDto(topup),
    balance: user?.balance ?? 0,
  });
}

async function failTopupIfExpired(topup: {
  id: string;
  status: string;
  expiredAt?: Date | null;
}) {
  if (!supportsTopupExpiredAt) return null;
  if (String(topup.status ?? "").toUpperCase() !== "PENDING") return null;
  if (!topup.expiredAt) return null;
  if (topup.expiredAt.getTime() > Date.now()) return null;

  const lock = await prisma.userTopup.updateMany({
    where: {
      id: topup.id,
      status: "PENDING",
    },
    data: {
      status: "FAILED",
      providerStatus: "EXPIRED",
    },
  });
  if (lock.count === 0) {
    return prisma.userTopup.findUnique({ where: { id: topup.id } });
  }

  await publishTopupUpdate(topup.id, "updated");
  return prisma.userTopup.findUnique({ where: { id: topup.id } });
}

export async function expirePendingTopupsForUser(userId: string) {
  if (!supportsTopupExpiredAt) return 0;

  const now = new Date();
  const expiredRows = await prisma.userTopup.findMany({
    where: {
      userId,
      status: "PENDING",
      expiredAt: {
        lte: now,
      },
    },
    select: { id: true },
  });
  if (expiredRows.length === 0) return 0;

  const ids = expiredRows.map((x) => x.id);
  const updated = await prisma.userTopup.updateMany({
    where: {
      id: { in: ids },
      status: "PENDING",
    },
    data: {
      status: "FAILED",
      providerStatus: "EXPIRED",
    },
  });

  await Promise.all(ids.map((id) => publishTopupUpdate(id, "updated")));
  return updated.count;
}

export async function createTopupForUser(input: {
  userId: string;
  amount: number;
  methodCode: string;
}) {
  const amount = toInt(input.amount);
  if (!Number.isFinite(amount) || amount < 1000) {
    throw new HttpError(400, "Minimal topup adalah Rp1.000");
  }

  const methodCode = "QRIS";

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw new HttpError(404, "User tidak ditemukan");

  await expirePendingTopupsForUser(input.userId);

  const existingPending = await prisma.userTopup.findFirst({
    where: {
      userId: input.userId,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: { reffId: true },
  });
  if (existingPending) {
    throw new HttpError(
      400,
      `Masih ada deposit pending (${existingPending.reffId}). Batalkan dulu sebelum membuat deposit baru.`,
    );
  }

  const reffId = makeReffId(user.id);
  const createRes = await myPgCreateOrder({
    orderId: reffId,
    amount,
    note: `Topup saldo ${user.name || user.email}`,
    via: "Web",
  });

  const normalized = extractStatusData(createRes);
  const expiredAtData = supportsTopupExpiredAt
    ? { expiredAt: normalized.expiredAt }
    : {};
  const saved = await prisma.userTopup.create({
    data: {
      userId: input.userId,
      reffId,
      methodCode,
      amount,
      providerStatus: normalized.providerStatus || "PENDING",
      status: normalized.status,
      providerRef: normalized.providerRef,
      providerTrxId: normalized.providerTrxId,
      totalBayar: normalized.totalBayar || null,
      totalDiterima: normalized.totalDiterima || null,
      payUrl: normalized.payUrl,
      checkoutUrl: normalized.checkoutUrl,
      qrLink: normalized.qrLink,
      qrString: normalized.qrString,
      ...expiredAtData,
      nomorVa: normalized.nomorVa,
      panduanPembayaran: normalized.panduanPembayaran,
      rawCreate: createRes as any,
    },
  });

  if (saved.status === "PAID") {
    const credited = await creditIfPaid(saved.id);
    await publishTopupUpdate(saved.id, credited ? "credited" : "updated");
  } else {
    await publishTopupUpdate(saved.id, "created");
  }

  const current = await prisma.userTopup.findUnique({ where: { id: saved.id } });
  return current ? toTopupDto(current) : toTopupDto(saved);
}

export async function syncTopupStatusForUser(userId: string, topupId: string) {
  const topup = await prisma.userTopup.findFirst({
    where: { id: topupId, userId },
  });
  if (!topup) throw new HttpError(404, "Topup tidak ditemukan");
  if (String(topup.status).toUpperCase() === "CANCELED") {
    throw new HttpError(400, "Topup sudah dibatalkan");
  }

  const alreadyExpired = await failTopupIfExpired(topup);
  if (alreadyExpired) {
    return toTopupDto(alreadyExpired);
  }

  const statusRes = await myPgCheckOrderStatus({
    orderId: topup.reffId,
  });

  const normalized = extractStatusData(statusRes);
  const mergedExpiredAt = supportsTopupExpiredAt
    ? normalized.expiredAt ?? (topup as any).expiredAt ?? null
    : null;
  const mergedStatus = applyExpiredStatus({
    providerStatus: normalized.providerStatus || topup.providerStatus,
    status: normalized.status || topup.status,
    expiredAt: mergedExpiredAt,
  });
  const expiredAtData = supportsTopupExpiredAt ? { expiredAt: mergedExpiredAt } : {};

  const updated = await prisma.userTopup.update({
    where: { id: topup.id },
    data: {
      providerStatus: mergedStatus.providerStatus,
      status: mergedStatus.status,
      providerRef: normalized.providerRef ?? topup.providerRef,
      providerTrxId: normalized.providerTrxId ?? topup.providerTrxId,
      totalBayar: normalized.totalBayar || topup.totalBayar,
      totalDiterima: normalized.totalDiterima || topup.totalDiterima,
      payUrl: normalized.payUrl ?? topup.payUrl,
      checkoutUrl: normalized.checkoutUrl ?? topup.checkoutUrl,
      qrLink: normalized.qrLink ?? topup.qrLink,
      qrString: normalized.qrString ?? topup.qrString,
      ...expiredAtData,
      nomorVa: normalized.nomorVa ?? topup.nomorVa,
      panduanPembayaran: normalized.panduanPembayaran ?? topup.panduanPembayaran,
      rawStatus: statusRes as any,
      ...(mergedStatus.status === "PAID" ? { paidAt: new Date() } : {}),
    },
  });

  if (updated.status === "PAID") {
    const credited = await creditIfPaid(updated.id);
    await publishTopupUpdate(updated.id, credited ? "credited" : "updated");
  } else {
    await publishTopupUpdate(updated.id, "updated");
  }

  const current = await prisma.userTopup.findUnique({ where: { id: updated.id } });
  return current ? toTopupDto(current) : toTopupDto(updated);
}

export async function cancelTopupForUser(userId: string, topupId: string) {
  const topup = await prisma.userTopup.findFirst({
    where: { id: topupId, userId },
  });
  if (!topup) throw new HttpError(404, "Topup tidak ditemukan");

  const status = String(topup.status ?? "").toUpperCase();
  if (status === "PAID" || topup.creditedAt) {
    throw new HttpError(400, "Topup sudah dibayar, tidak bisa dibatalkan");
  }

  if (status === "CANCELED" || status === "FAILED") {
    return toTopupDto(topup);
  }

  const updated = await prisma.userTopup.update({
    where: { id: topup.id },
    data: {
      status: "CANCELED",
      providerStatus: "CANCELED_BY_USER",
      payUrl: null,
      checkoutUrl: null,
      qrLink: null,
      qrString: null,
      nomorVa: null,
      panduanPembayaran: null,
      rawStatus: {
        event: "user_cancel",
        at: new Date().toISOString(),
        prevStatus: topup.status,
        prevProviderStatus: topup.providerStatus,
      } as any,
    },
  });

  await publishTopupUpdate(updated.id, "canceled");
  const current = await prisma.userTopup.findUnique({ where: { id: updated.id } });
  return current ? toTopupDto(current) : toTopupDto(updated);
}

function firstOf(x: unknown) {
  if (Array.isArray(x)) return x[0];
  return x;
}

export function parseMyPgWebhookPayload(payload: Record<string, unknown>) {
  const dataObj =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  const reffId = String(
    firstOf(dataObj.order_id ?? payload.order_id ?? payload.reffId ?? payload.refId ?? "") ??
      "",
  ).trim();

  const status = String(
    firstOf(dataObj.status ?? payload.status ?? "PENDING") ?? "PENDING",
  ).trim();
  const expiredAt = parseMaybeDate(
    firstOf(
      dataObj.expired_at ??
        dataObj.expiredAt ??
        dataObj.expires_at ??
        dataObj.expiresAt ??
        payload.expired_at ??
        payload.expiredAt ??
        payload.expires_at ??
        payload.expiresAt,
    ),
  );
  const normalized = applyExpiredStatus({
    providerStatus: status,
    status,
    expiredAt,
  });

  return {
    reffId,
    providerStatus: normalized.providerStatus,
    status: normalized.status,
    expiredAt: normalized.expiredAt,
    providerRef:
      String(firstOf(dataObj.order_id ?? payload.order_id ?? "") ?? "").trim() || null,
    providerTrxId:
      String(firstOf(dataObj.signature ?? payload.signature ?? "") ?? "").trim() || null,
    totalBayar: toInt(
      firstOf(dataObj.amount_paid ?? dataObj.total_amount ?? dataObj.amount),
    ),
    totalDiterima: toInt(firstOf(dataObj.amount_request ?? dataObj.amount)),
    payUrl:
      String(firstOf(dataObj.direct_url ?? payload.direct_url ?? "") ?? "").trim() || null,
    checkoutUrl:
      String(firstOf(dataObj.direct_url ?? payload.direct_url ?? "") ?? "").trim() ||
      null,
    qrLink: String(firstOf(dataObj.qris_url ?? payload.qris_url ?? "") ?? "").trim() || null,
    qrString:
      String(firstOf(dataObj.qris_image ?? payload.qris_image ?? "") ?? "").trim() || null,
    nomorVa: null,
    panduanPembayaran: null,
  };
}

export async function applyMyPgWebhook(payload: Record<string, unknown>) {
  const parsed = parseMyPgWebhookPayload(payload);
  if (!parsed.reffId) return null;

  const topup = await prisma.userTopup.findUnique({
    where: { reffId: parsed.reffId },
  });
  if (!topup) return null;

  const mergedExpiredAt = supportsTopupExpiredAt
    ? parsed.expiredAt ?? (topup as any).expiredAt ?? null
    : null;
  const mergedStatus = applyExpiredStatus({
    providerStatus: parsed.providerStatus || topup.providerStatus,
    status: parsed.status || topup.status,
    expiredAt: mergedExpiredAt,
  });
  const expiredAtData = supportsTopupExpiredAt ? { expiredAt: mergedExpiredAt } : {};

  const updated = await prisma.userTopup.update({
    where: { id: topup.id },
    data: {
      providerStatus: mergedStatus.providerStatus,
      status: mergedStatus.status,
      providerRef: parsed.providerRef ?? topup.providerRef,
      providerTrxId: parsed.providerTrxId ?? topup.providerTrxId,
      totalBayar: parsed.totalBayar || topup.totalBayar,
      totalDiterima: parsed.totalDiterima || topup.totalDiterima,
      payUrl: parsed.payUrl ?? topup.payUrl,
      checkoutUrl: parsed.checkoutUrl ?? topup.checkoutUrl,
      qrLink: parsed.qrLink ?? topup.qrLink,
      qrString: parsed.qrString ?? topup.qrString,
      ...expiredAtData,
      nomorVa: parsed.nomorVa ?? topup.nomorVa,
      panduanPembayaran: parsed.panduanPembayaran ?? topup.panduanPembayaran,
      rawWebhook: payload as any,
      ...(mergedStatus.status === "PAID" ? { paidAt: new Date() } : {}),
    },
  });

  if (updated.status === "PAID") {
    const credited = await creditIfPaid(updated.id);
    await publishTopupUpdate(updated.id, credited ? "credited" : "updated");
  } else {
    await publishTopupUpdate(updated.id, "updated");
  }

  return prisma.userTopup.findUnique({ where: { id: updated.id } });
}
