import { prisma } from "../../prisma";
import { HttpError } from "../../utils/errors";
import {
  myPgCheckOrderStatus,
  myPgCreateOrder,
} from "./mypg.client";
import { publishTopupEvent } from "./topupRealtime";
import { applyBalanceMutationTx } from "../balance/balanceMutations.service";

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
  const providerStatus = String(data?.status ?? "PENDING").trim();
  const normalizedStatus = parseTopupStatus(providerStatus);
  const directUrl = String(data?.direct_url ?? "").trim() || null;
  const qrisUrl = String(data?.qris_url ?? "").trim() || null;
  const qrisImage = String(data?.qris_image ?? "").trim() || null;

  return {
    providerStatus,
    status: normalizedStatus,
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

  const statusRes = await myPgCheckOrderStatus({
    orderId: topup.reffId,
  });

  const normalized = extractStatusData(statusRes);
  const updated = await prisma.userTopup.update({
    where: { id: topup.id },
    data: {
      providerStatus: normalized.providerStatus || topup.providerStatus,
      status: normalized.status,
      providerRef: normalized.providerRef ?? topup.providerRef,
      providerTrxId: normalized.providerTrxId ?? topup.providerTrxId,
      totalBayar: normalized.totalBayar || topup.totalBayar,
      totalDiterima: normalized.totalDiterima || topup.totalDiterima,
      payUrl: normalized.payUrl ?? topup.payUrl,
      checkoutUrl: normalized.checkoutUrl ?? topup.checkoutUrl,
      qrLink: normalized.qrLink ?? topup.qrLink,
      qrString: normalized.qrString ?? topup.qrString,
      nomorVa: normalized.nomorVa ?? topup.nomorVa,
      panduanPembayaran: normalized.panduanPembayaran ?? topup.panduanPembayaran,
      rawStatus: statusRes as any,
      ...(normalized.status === "PAID" ? { paidAt: new Date() } : {}),
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

  return {
    reffId,
    providerStatus: status,
    status: parseTopupStatus(status),
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

  const updated = await prisma.userTopup.update({
    where: { id: topup.id },
    data: {
      providerStatus: parsed.providerStatus || topup.providerStatus,
      status: parsed.status,
      providerRef: parsed.providerRef ?? topup.providerRef,
      providerTrxId: parsed.providerTrxId ?? topup.providerTrxId,
      totalBayar: parsed.totalBayar || topup.totalBayar,
      totalDiterima: parsed.totalDiterima || topup.totalDiterima,
      payUrl: parsed.payUrl ?? topup.payUrl,
      checkoutUrl: parsed.checkoutUrl ?? topup.checkoutUrl,
      qrLink: parsed.qrLink ?? topup.qrLink,
      qrString: parsed.qrString ?? topup.qrString,
      nomorVa: parsed.nomorVa ?? topup.nomorVa,
      panduanPembayaran: parsed.panduanPembayaran ?? topup.panduanPembayaran,
      rawWebhook: payload as any,
      ...(parsed.status === "PAID" ? { paidAt: new Date() } : {}),
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
