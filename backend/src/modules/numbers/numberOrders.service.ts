import { prisma } from "../../prisma";
import { HttpError } from "../../utils/errors";
import {
  cancelActivation,
  completeActivation,
  getActivationStatus,
  type HeroSmsActivationStatus,
} from "../herosms/herosms.client";
import { publishNumberEvent } from "./numbersRealtime";
import { applyBalanceMutationTx } from "../balance/balanceMutations.service";

const CANCEL_UNLOCK_DELAY_MS = 130 * 1000; // 1 menit 70 detik (2m10s)

function normalizeStatus(raw?: string) {
  return String(raw ?? "").trim().toUpperCase();
}

function isCanceledStatus(raw?: string) {
  const status = normalizeStatus(raw);
  return status.includes("CANCEL") || status.includes("TIMEOUT");
}

function firstValue(input: unknown) {
  if (Array.isArray(input)) return input[0];
  return input;
}

function parseStatusCode(raw?: string) {
  const line = String(raw ?? "").trim();
  if (!line.startsWith("STATUS_")) {
    return { status: line || undefined, code: undefined as string | undefined };
  }

  const idx = line.indexOf(":");
  if (idx < 0) return { status: line, code: undefined };

  const status = line.slice(0, idx).trim();
  const code = line.slice(idx + 1).trim();
  return { status: status || undefined, code: code || undefined };
}

function parseSmsCodeFromUnknown(input: unknown): string | undefined {
  if (typeof input === "string") {
    const v = input.trim();
    return v || undefined;
  }

  if (Array.isArray(input) && input.length > 0) {
    return parseSmsCodeFromUnknown(input[input.length - 1]);
  }

  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const direct =
      obj.code ?? obj.smsCode ?? obj.otp ?? obj.text ?? obj.message;
    return parseSmsCodeFromUnknown(direct);
  }

  return undefined;
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

  const normalized = raw.includes(" ") && !raw.includes("T")
    ? raw.replace(" ", "T")
    : raw;
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;
  return undefined;
}

function normalizeActivationWindowForOrder(input: {
  createdAt?: Date | null;
  activationTime?: Date | null;
  activationEndTime?: Date | null;
}) {
  const createdAt = input.createdAt ?? null;
  const activationTime = input.activationTime ?? null;
  const activationEndTime = input.activationEndTime ?? null;

  if (!createdAt || !activationTime || !activationEndTime) {
    return { activationTime, activationEndTime };
  }

  const diffMs = createdAt.getTime() - activationTime.getTime();
  const absDiffMs = Math.abs(diffMs);
  const minShiftMs = 2 * 60 * 60 * 1000; // >= 2 jam dianggap mismatch timezone
  const maxShiftMs = 12 * 60 * 60 * 1000; // batas aman koreksi timezone

  if (absDiffMs < minShiftMs || absDiffMs > maxShiftMs) {
    return { activationTime, activationEndTime };
  }

  return {
    activationTime: new Date(activationTime.getTime() + diffMs),
    activationEndTime: new Date(activationEndTime.getTime() + diffMs),
  };
}

function activationWindowFromRaw(raw: unknown) {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const getStatusV2 =
    source.getStatusV2 && typeof source.getStatusV2 === "object"
      ? (source.getStatusV2 as Record<string, unknown>)
      : {};
  const payload =
    source.payload && typeof source.payload === "object"
      ? (source.payload as Record<string, unknown>)
      : {};
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  const activationTime = parseMaybeDate(
    source.activationTime ??
      source.activation_time ??
      getStatusV2.activationTime ??
      getStatusV2.activation_time ??
      payload.activationTime ??
      payload.activation_time ??
      data.activationTime ??
      data.activation_time,
  );

  const activationEndTime = parseMaybeDate(
    source.activationEndTime ??
      source.activation_end_time ??
      getStatusV2.activationEndTime ??
      getStatusV2.activation_end_time ??
      payload.activationEndTime ??
      payload.activation_end_time ??
      data.activationEndTime ??
      data.activation_end_time,
  );

  return { activationTime, activationEndTime };
}

export function toNumberOrderDto(row: any) {
  const fallbackWindow = activationWindowFromRaw(row.providerRaw);
  const rawActivationTime = row.activationTime ?? fallbackWindow.activationTime ?? null;
  const rawActivationEndTime =
    row.activationEndTime ?? fallbackWindow.activationEndTime ?? null;
  const normalizedWindow = normalizeActivationWindowForOrder({
    createdAt: row.createdAt,
    activationTime: rawActivationTime,
    activationEndTime: rawActivationEndTime,
  });
  const activationTime = normalizedWindow.activationTime;
  const activationEndTime = normalizedWindow.activationEndTime;

  return {
    id: row.id,
    activationId: row.activationId,
    phoneNumber: row.phoneNumber,
    service: row.service,
    serviceName: row.serviceName,
    country: row.country,
    countryName: row.countryName,
    pricePaid: row.pricePaid,
    profitAmount: row.profitAmount,
    status: row.status,
    smsCode: row.smsCode,
    smsText: row.smsText,
    activationTime,
    activationEndTime,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastSyncedAt: row.lastSyncedAt,
    refundedAt: row.refundedAt,
  };
}

async function refundCanceledOrderOnce(orderId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const lock = await tx.userNumberOrder.updateMany({
      where: {
        id: orderId,
        refundedAt: null,
        NOT: { status: "STATUS_COMPLETED" },
        OR: [
          { status: { contains: "CANCEL" } },
          { status: { contains: "TIMEOUT" } },
        ],
      },
      data: {
        refundedAt: new Date(),
        profitAmount: 0,
      },
    });

    if (lock.count === 0) return null;

    const order = await tx.userNumberOrder.findUnique({ where: { id: orderId } });
    if (!order) return null;

    const serviceName = String(order.serviceName ?? order.service).toUpperCase();
    const countryName = String(order.countryName ?? `Country ${order.country}`);

    await applyBalanceMutationTx(tx, {
      userId: order.userId,
      direction: "CREDIT",
      amount: order.pricePaid,
      type: "ORDER_REFUND",
      referenceType: "NUMBER_ORDER",
      referenceId: order.id,
      description: `Refund order cancel ${serviceName} - ${countryName}`,
      metadata: {
        activationId: order.activationId,
        status: order.status,
        reason,
      },
    });

    const [latestOrder, user] = await Promise.all([
      tx.userNumberOrder.findUnique({ where: { id: order.id } }),
      tx.user.findUnique({
        where: { id: order.userId },
        select: { balance: true },
      }),
    ]);

    return {
      order: latestOrder ?? order,
      balance: Number(user?.balance ?? 0),
    };
  });
}

async function updateOrderStatusByActivationId(
  activationId: string,
  input: {
    status?: string;
    smsCode?: string;
    smsText?: string;
    smsPayload?: unknown;
    providerRaw?: unknown;
    activationTime?: Date;
    activationEndTime?: Date;
  },
) {
  const existing = await prisma.userNumberOrder.findUnique({
    where: { activationId },
  });

  if (!existing) return null;

  const incomingStatus = normalizeStatus(input.status) || existing.status;
  const nextStatus =
    normalizeStatus(existing.status) === "STATUS_COMPLETED"
      ? "STATUS_COMPLETED"
      : incomingStatus;
  const nextCode = input.smsCode ?? existing.smsCode ?? undefined;
  const nextText = input.smsText ?? existing.smsText ?? nextCode ?? undefined;

  const updated = await prisma.userNumberOrder.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      smsCode: nextCode,
      smsText: nextText,
      smsPayload:
        input.smsPayload === undefined ? existing.smsPayload : (input.smsPayload as any),
      providerRaw:
        input.providerRaw === undefined ? existing.providerRaw : (input.providerRaw as any),
      activationTime: input.activationTime ?? existing.activationTime,
      activationEndTime: input.activationEndTime ?? existing.activationEndTime,
      lastSyncedAt: new Date(),
    },
  });

  let eventItem = updated;
  let eventBalance: number | undefined;

  if (isCanceledStatus(nextStatus)) {
    const refunded = await refundCanceledOrderOnce(updated.id, "provider_status_cancel");
    if (refunded?.order) {
      eventItem = refunded.order as any;
      eventBalance = refunded.balance;
    }
  }

  publishNumberEvent(updated.userId, {
    type: isCanceledStatus(nextStatus) ? "order_canceled" : "status_updated",
    item: toNumberOrderDto(eventItem),
    ...(eventBalance !== undefined ? { balance: eventBalance } : {}),
  });

  return eventItem;
}

function normalizeFromProviderStatus(status: HeroSmsActivationStatus) {
  const parsed = parseStatusCode(status.status);
  return {
    status: parsed.status ?? status.status,
    smsCode: status.smsCode ?? parsed.code,
    smsText: status.smsText ?? status.smsCode ?? parsed.code,
    smsPayload: status.smsPayload,
    providerRaw: status.raw,
    activationTime: status.activationTime,
    activationEndTime: status.activationEndTime,
  };
}

export async function syncNumberOrderForUser(userId: string, orderId: string) {
  const row = await prisma.userNumberOrder.findFirst({
    where: { id: orderId, userId },
  });
  if (!row) throw new HttpError(404, "Order tidak ditemukan");

  const providerStatus = await getActivationStatus(row.activationId);
  const normalized = normalizeFromProviderStatus(providerStatus);

  const updated = await updateOrderStatusByActivationId(row.activationId, normalized);
  if (!updated) throw new HttpError(404, "Order tidak ditemukan");

  return updated;
}

export async function cancelNumberOrderForUser(userId: string, orderId: string) {
  const row = await prisma.userNumberOrder.findFirst({
    where: { id: orderId, userId },
  });
  if (!row) throw new HttpError(404, "Order tidak ditemukan");

  const status = normalizeStatus(row.status);
  if (status.includes("CANCEL")) {
    const refunded = await refundCanceledOrderOnce(row.id, "existing_canceled_order");
    if (refunded?.order) {
      publishNumberEvent(row.userId, {
        type: "order_canceled",
        item: toNumberOrderDto(refunded.order),
        balance: refunded.balance,
      });
      return refunded.order;
    }
    return row;
  }
  if (status === "STATUS_OK" || status === "STATUS_COMPLETED") {
    throw new HttpError(400, "Order sudah selesai, tidak bisa dibatalkan");
  }

  const fallbackWindow = activationWindowFromRaw(row.providerRaw);
  const normalizedWindow = normalizeActivationWindowForOrder({
    createdAt: row.createdAt,
    activationTime: row.activationTime ?? fallbackWindow.activationTime ?? null,
    activationEndTime: row.activationEndTime ?? fallbackWindow.activationEndTime ?? null,
  });
  const now = Date.now();
  const cancelUnlockAt = normalizedWindow.activationTime
    ? new Date(normalizedWindow.activationTime.getTime() + CANCEL_UNLOCK_DELAY_MS)
    : normalizedWindow.activationEndTime ?? row.activationEndTime ?? null;

  if (!cancelUnlockAt) {
    throw new HttpError(400, "Waktu aktivasi belum tersedia, coba sync status dulu");
  }

  if (cancelUnlockAt.getTime() > now) {
    throw new HttpError(400, "Pembatalan belum tersedia. Tunggu timer unlock selesai");
  }

  const canceled = await cancelActivation(row.activationId);

  const updated = await prisma.userNumberOrder.update({
    where: { id: row.id },
    data: {
      status: "STATUS_CANCEL",
      providerRaw: {
        event: "user_cancel_after_expired",
        at: new Date().toISOString(),
        provider: canceled.raw,
      } as any,
      lastSyncedAt: new Date(),
    },
  });

  const refunded = await refundCanceledOrderOnce(
    updated.id,
    "user_cancel_after_unlock",
  );
  const eventItem = refunded?.order ?? updated;

  publishNumberEvent(updated.userId, {
    type: "order_canceled",
    item: toNumberOrderDto(eventItem),
    ...(refunded ? { balance: refunded.balance } : {}),
  });

  return eventItem;
}

export async function completeNumberOrderForUser(userId: string, orderId: string) {
  const row = await prisma.userNumberOrder.findFirst({
    where: { id: orderId, userId },
  });
  if (!row) throw new HttpError(404, "Order tidak ditemukan");

  const status = normalizeStatus(row.status);
  if (status.includes("CANCEL")) {
    throw new HttpError(400, "Order sudah dibatalkan");
  }
  if (status === "STATUS_COMPLETED") {
    return row;
  }
  const hasSms = !!String(row.smsCode ?? row.smsText ?? "").trim();
  if (!hasSms) {
    throw new HttpError(400, "Kode SMS belum diterima");
  }

  const completed = await completeActivation(row.activationId);

  const updated = await prisma.userNumberOrder.update({
    where: { id: row.id },
    data: {
      status: "STATUS_COMPLETED",
      providerRaw: {
        event: "user_complete_after_sms_received",
        at: new Date().toISOString(),
        prevStatus: row.status,
        provider: completed.raw,
      } as any,
      lastSyncedAt: new Date(),
    },
  });

  publishNumberEvent(updated.userId, {
    type: "status_updated",
    item: toNumberOrderDto(updated),
  });

  return updated;
}

export function parseWebhookPayload(
  payload: Record<string, unknown>,
  rawText?: string,
) {
  const activationId = String(
    firstValue(
      payload.activationId ??
      payload.activation_id ??
      payload.id ??
      payload.request_id ??
      payload.requestId,
    ) ??
      "",
  ).trim();

  const statusSource = firstValue(
    payload.status ??
      payload.state ??
      payload.message ??
      payload.result,
  );

  const statusRaw =
    String(statusSource ?? rawText ?? "").trim() || undefined;

  const parsed = parseStatusCode(statusRaw);

  const smsAny = firstValue(
    payload.sms ??
    payload.sms_code ??
    payload.smsCode ??
    payload.code ??
    payload.otp,
  );
  const smsCode = parseSmsCodeFromUnknown(smsAny) ?? parsed.code;
  const smsText =
    parseSmsCodeFromUnknown(
      firstValue(payload.text ?? payload.smsText ?? payload.message),
    ) ?? smsCode;

  const dataObj =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  const activationTime = parseMaybeDate(
    firstValue(
      payload.activationTime ??
      payload.activation_time ??
      payload.createdAt ??
      payload.created_at ??
      dataObj.activationTime ??
      dataObj.activation_time ??
      dataObj.createdAt ??
      dataObj.created_at,
    ),
  );
  const activationEndTime = parseMaybeDate(
    firstValue(
      payload.activationEndTime ??
      payload.activation_end_time ??
      payload.endTime ??
      payload.end_time ??
      payload.expiredAt ??
      payload.expiresAt ??
      dataObj.activationEndTime ??
      dataObj.activation_end_time ??
      dataObj.endTime ??
      dataObj.end_time ??
      dataObj.expiredAt ??
      dataObj.expiresAt,
    ),
  );

  return {
    activationId,
    status: parsed.status ?? normalizeStatus(statusRaw),
    smsCode,
    smsText,
    activationTime,
    activationEndTime,
    smsPayload: payload.sms,
    providerRaw: {
      payload,
      rawText,
    },
  };
}

export async function applyWebhookUpdate(
  payload: Record<string, unknown>,
  rawText?: string,
) {
  const normalized = parseWebhookPayload(payload, rawText);
  if (!normalized.activationId) {
    return null;
  }

  return updateOrderStatusByActivationId(normalized.activationId, normalized);
}
