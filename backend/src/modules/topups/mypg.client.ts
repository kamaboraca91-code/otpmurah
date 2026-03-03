import { env } from "../../env";
import { HttpError } from "../../utils/errors";

type Json = Record<string, any>;

function requireConfig() {
  if (!env.MYPG_API_KEY || !env.MYPG_MERCHANT_ID) {
    throw new HttpError(
      500,
      "MY PG belum dikonfigurasi (MYPG_API_KEY / MYPG_MERCHANT_ID)",
    );
  }
}

function baseUrl() {
  return env.MYPG_BASE_URL.replace(/\/+$/, "");
}

function isSuccessStatus(value: unknown) {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "success", "ok", "berhasil"].includes(normalized);
}

function extractProviderMessage(data: Json) {
  return String(data?.message ?? data?.error_msg ?? data?.msg ?? "").trim();
}

function extractTextMessage(text: string) {
  const clean = String(text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.slice(0, 220);
}

function mapProviderError(message: string) {
  if (/qris payload configuration is missing/i.test(message)) {
    return new HttpError(
      400,
      "Konfigurasi QRIS MY PG belum diisi. Buka aplikasi/dashboard KlikQRIS, lalu atur QRIS Payload terlebih dahulu.",
    );
  }
  return new HttpError(502, message || "MY PG request gagal");
}

async function safeJson(text: string): Promise<Json> {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return {};
  }
}

async function readProviderResponse(res: Response) {
  const text = await res.text();
  const data = await safeJson(text);
  return { data, text };
}

export type MyPgCreateOrderInput = {
  orderId: string;
  amount: number;
  note?: string;
  via?: string;
};

export async function myPgCreateOrder(input: MyPgCreateOrderInput) {
  requireConfig();

  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 1000) {
    throw new HttpError(400, "Minimal topup adalah Rp1.000");
  }

  const payload = {
    order_id: input.orderId,
    id_merchant: env.MYPG_MERCHANT_ID,
    amount,
    keterangan: String(input.note ?? "").trim() || `Topup saldo (${input.orderId})`,
    via: String(input.via ?? "").trim() || "Web",
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.MYPG_API_KEY,
        id_merchant: env.MYPG_MERCHANT_ID,
      },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    throw new HttpError(
      502,
      `Gagal koneksi ke MY PG. ${String(err?.message ?? "Network error")}`,
    );
  }

  const { data, text } = await readProviderResponse(res);
  const providerMessage =
    extractProviderMessage(data) || extractTextMessage(text) || "";

  if (!res.ok) {
    throw mapProviderError(
      providerMessage || `MY PG request failed (HTTP ${res.status})`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new HttpError(502, "MY PG invalid response");
  }

  if (!isSuccessStatus(data.status)) {
    throw mapProviderError(providerMessage || "MY PG gagal membuat transaksi");
  }

  return data;
}

export type MyPgCheckStatusInput = {
  orderId: string;
};

export async function myPgCheckOrderStatus(input: MyPgCheckStatusInput) {
  requireConfig();

  const url = `${baseUrl()}/status/${encodeURIComponent(
    env.MYPG_MERCHANT_ID,
  )}/${encodeURIComponent(input.orderId)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": env.MYPG_API_KEY,
        id_merchant: env.MYPG_MERCHANT_ID,
      },
    });
  } catch (err: any) {
    throw new HttpError(
      502,
      `Gagal koneksi ke MY PG (status check). ${String(err?.message ?? "Network error")}`,
    );
  }

  const { data, text } = await readProviderResponse(res);
  const providerMessage =
    extractProviderMessage(data) || extractTextMessage(text) || "";

  if (!res.ok) {
    throw mapProviderError(
      providerMessage || `MY PG status check failed (HTTP ${res.status})`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new HttpError(502, "MY PG invalid status response");
  }

  if (!isSuccessStatus(data.status)) {
    throw mapProviderError(
      providerMessage || "MY PG gagal cek status transaksi",
    );
  }

  return data;
}

export function verifyMyPgWebhookPayload(payload: Record<string, unknown>) {
  requireConfig();

  const dataObj =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  const orderId = String(dataObj.order_id ?? payload.order_id ?? "").trim();
  if (!orderId) return false;

  const merchantId = String(
    dataObj.merchant_id ?? payload.merchant_id ?? payload.id_merchant ?? "",
  ).trim();

  if (merchantId && merchantId !== env.MYPG_MERCHANT_ID) {
    return false;
  }

  return true;
}
