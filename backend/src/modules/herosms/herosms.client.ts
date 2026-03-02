import { prisma } from "../../prisma"; // sesuaikan path
import { HttpError } from "../../utils/errors";
import { env } from "../../env";

const HEROSMS_BASE_URL =
  env.HEROSMS_BASE_URL || "https://hero-sms.com/stubs/handler_api.php";
const HEROSMS_API_KEY = env.HEROSMS_API_KEY;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function clearCachePrefix(prefix: string) {
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}

export function invalidateHeroSmsPricingCaches() {
  clearCachePrefix("herosms:pricing:");
  clearCachePrefix("herosms:top-countries:");
}

export function invalidateHeroSmsTopCountriesCaches() {
  clearCachePrefix("herosms:top-countries:");
}

function getCached<T>(key: string): T | undefined {
  const hit = responseCache.get(key);
  if (!hit) return undefined;

  if (hit.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return undefined;
  }

  return hit.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number) {
  if (ttlMs <= 0) return;
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

async function withCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const run = loader()
    .then((value) => {
      setCached(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, run as Promise<unknown>);
  return run;
}

type FetchOptions = {
  bypassCache?: boolean;
};

function maybeCached<T>(
  key: string,
  ttlMs: number,
  options: FetchOptions | undefined,
  loader: () => Promise<T>,
) {
  if (options?.bypassCache) {
    return loader();
  }
  return withCache(key, ttlMs, loader);
}

function buildHeroSmsUrl(
  params: Record<string, string | number | boolean | undefined>,
) {
  const url = new URL(HEROSMS_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function parseJsonSafe(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function heroGetJson(
  params: Record<string, string | number | boolean | undefined>,
) {
  if (!HEROSMS_API_KEY) throw new HttpError(500, "HEROSMS_API_KEY is not set");

  const url = buildHeroSmsUrl({
    api_key: HEROSMS_API_KEY,
    ...params,
  });

  const res = await fetch(url, { method: "GET" });
  const text = await res.text();

  if (!res.ok) {
    throw new HttpError(502, `HeroSMS error (${res.status}): ${text}`);
  }

  const json = await parseJsonSafe(text);
  if (!json) {
    // bisa teks error (BAD_KEY, BAD_ACTION, etc)
    throw new HttpError(502, `HeroSMS non-JSON response: ${text}`);
  }

  return json;
}

async function heroGetText(
  params: Record<string, string | number | boolean | undefined>,
) {
  if (!HEROSMS_API_KEY) throw new HttpError(500, "HEROSMS_API_KEY is not set");

  const url = buildHeroSmsUrl({
    api_key: HEROSMS_API_KEY,
    ...params,
  });

  const res = await fetch(url, { method: "GET" });
  const text = await res.text();

  if (!res.ok) {
    throw new HttpError(502, `HeroSMS error (${res.status}): ${text}`);
  }

  return String(text ?? "").trim();
}

/* =========================
   Services
========================= */

export type HeroSmsService = {
  code: string;
  name: string;
};

export async function getServiceList(
  options?: FetchOptions,
): Promise<HeroSmsService[]> {
  return maybeCached(
    "herosms:services",
    env.HEROSMS_SERVICES_CACHE_TTL_MS,
    options,
    async () => {
      const json = await heroGetJson({ action: "getServicesList" });

      // Umumnya: { status: "success", services: [...] }
      const servicesRaw = Array.isArray(json) ? json : json.services;

      if (!Array.isArray(servicesRaw)) {
        const message =
          (json as any)?.message ||
          (json as any)?.error ||
          "Invalid services payload";
        throw new HttpError(502, `HeroSMS invalid payload: ${message}`);
      }

      return servicesRaw
        .map((s: any) => ({
          code: String(s.code ?? s.service ?? s.id ?? ""),
          name: String(s.name ?? s.title ?? s.code ?? ""),
        }))
        .filter((s: HeroSmsService) => s.code && s.name);
    },
  );
}

/* =========================
   Countries
========================= */

export type HeroSmsCountry = {
  id: number;
  rus: string;
  eng: string;
  chn: string;
  visible: number;
  retry: number;
};

export async function getCountries(
  options?: FetchOptions,
): Promise<HeroSmsCountry[]> {
  return maybeCached(
    "herosms:countries",
    env.HEROSMS_COUNTRIES_CACHE_TTL_MS,
    options,
    async () => {
      const json = await heroGetJson({ action: "getCountries" });

      if (!Array.isArray(json)) {
        const message =
          (json as any)?.message ||
          (json as any)?.error ||
          "Invalid countries payload";
        throw new HttpError(502, `HeroSMS invalid payload: ${message}`);
      }

      return (json as any[])
        .map((c: any) => ({
          id: Number(c.id),
          rus: String(c.rus ?? ""),
          eng: String(c.eng ?? ""),
          chn: String(c.chn ?? ""),
          visible: Number(c.visible ?? 0),
          retry: Number(c.retry ?? 0),
        }))
        .filter((c) => Number.isFinite(c.id));
    },
  );
}

/* =========================
   Top Countries By Service
   (stock + min price + retail price + freePriceMap)
========================= */

export type HeroSmsTopCountryOffer = {
  retail_price: number;
  retail_price_default?: number;
  custom_price?: number;
  is_custom_price?: boolean;
  country: number;
  freePriceMap?: Record<
    string,
    {
      count: number;
      retail_price: number; // IDR final (after rate + profit)
    }
  >;
  price: number; // min price
  count: number; // stock pcs (total)
};

export type HeroSmsActivationStatus = {
  activationId: string;
  status: string;
  smsCode?: string;
  smsText?: string;
  smsPayload?: unknown;
  activationTime?: Date;
  activationEndTime?: Date;
  raw: {
    getStatus?: string;
    getStatusV2?: unknown;
  };
};

function parseStatusLine(raw: string) {
  const line = String(raw ?? "").trim();
  if (!line) return { status: "", code: undefined as string | undefined };

  if (!line.startsWith("STATUS_")) {
    return { status: line, code: undefined };
  }

  const idx = line.indexOf(":");
  if (idx < 0) return { status: line, code: undefined };

  const status = line.slice(0, idx).trim();
  const code = line.slice(idx + 1).trim() || undefined;
  return { status, code };
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

function getActivationWindow(raw: any) {
  const source = raw && typeof raw === "object" ? raw : {};
  const data = source?.data && typeof source.data === "object" ? source.data : {};

  const activationTime = parseMaybeDate(
    source.activationTime ??
      source.activation_time ??
      source.createdAt ??
      source.created_at ??
      source.startTime ??
      source.start_time ??
      data.activationTime ??
      data.activation_time ??
      data.createdAt ??
      data.created_at ??
      data.startTime ??
      data.start_time,
  );

  const activationEndTime = parseMaybeDate(
    source.activationEndTime ??
      source.activation_end_time ??
      source.endTime ??
      source.end_time ??
      source.expiredAt ??
      source.expired_at ??
      source.expiresAt ??
      source.expires_at ??
      data.activationEndTime ??
      data.activation_end_time ??
      data.endTime ??
      data.end_time ??
      data.expiredAt ??
      data.expired_at ??
      data.expiresAt ??
      data.expires_at,
  );

  return { activationTime, activationEndTime };
}

function normalizeSmsFromV2(v2: any) {
  const sms = v2?.sms;

  if (Array.isArray(sms) && sms.length > 0) {
    const latest = sms[sms.length - 1];
    const code = String(
      latest?.code ?? latest?.smsCode ?? latest?.otp ?? latest?.text ?? "",
    ).trim();
    const text = String(latest?.text ?? latest?.message ?? code ?? "").trim();
    return { code: code || undefined, text: text || undefined, payload: sms };
  }

  if (sms && typeof sms === "object") {
    const code = String(
      sms.code ?? sms.smsCode ?? sms.otp ?? sms.text ?? "",
    ).trim();
    const text = String(sms.text ?? sms.message ?? code ?? "").trim();
    return { code: code || undefined, text: text || undefined, payload: sms };
  }

  if (typeof sms === "string") {
    const text = sms.trim();
    return { code: text || undefined, text: text || undefined, payload: sms };
  }

  return { code: undefined, text: undefined, payload: sms };
}

export async function getActivationStatus(
  activationId: string,
): Promise<HeroSmsActivationStatus> {
  const id = String(activationId ?? "").trim();
  if (!id) throw new HttpError(400, "Missing activationId");

  const [v2Result, statusResult] = await Promise.allSettled([
    heroGetJson({ action: "getStatusV2", id }),
    heroGetText({ action: "getStatus", id }),
  ]);

  const rawV2 = v2Result.status === "fulfilled" ? v2Result.value : undefined;
  const rawStatusLine =
    statusResult.status === "fulfilled" ? statusResult.value : undefined;

  if (!rawV2 && !rawStatusLine) {
    throw new HttpError(502, "Failed to fetch activation status from HeroSMS");
  }

  const parsedStatus = parseStatusLine(rawStatusLine ?? "");
  const fromV2 = normalizeSmsFromV2(rawV2);
  const activationWindow = getActivationWindow(rawV2);

  const smsCode = fromV2.code ?? parsedStatus.code;
  const smsText = fromV2.text ?? smsCode;

  const finalStatus =
    parsedStatus.status ||
    (smsCode ? "STATUS_OK" : "STATUS_WAIT_CODE");

  return {
    activationId: id,
    status: finalStatus,
    smsCode,
    smsText,
    smsPayload: fromV2.payload,
    activationTime: activationWindow.activationTime,
    activationEndTime: activationWindow.activationEndTime,
    raw: {
      getStatus: rawStatusLine,
      getStatusV2: rawV2,
    },
  };
}
type PricingSettings = {
  profitPercent: number; // 0..100
  usdToIdrRate: number; // contoh 16000
};

async function getPricingSettings(): Promise<PricingSettings> {
  return withCache(
    "herosms:pricing:global",
    env.HEROSMS_PRICING_CACHE_TTL_MS,
    async () => {
      // Karena model ini cuma untuk 1 set global, biasanya ambil latest
      const row = await prisma.adminPricingSettings.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { profitPercent: true, usdToIdrRate: true },
      });

      // fallback kalau tabel kosong (biar nggak crash di dev)
      const profitPercent = Number(row?.profitPercent ?? 10);
      const usdToIdrRate = Number(row?.usdToIdrRate ?? 16000);

      if (
        !Number.isFinite(profitPercent) ||
        profitPercent < 0 ||
        profitPercent > 100
      ) {
        throw new HttpError(500, "Invalid profitPercent in AdminPricingSettings");
      }
      if (!Number.isFinite(usdToIdrRate) || usdToIdrRate <= 0) {
        throw new HttpError(500, "Invalid usdToIdrRate in AdminPricingSettings");
      }

      return { profitPercent, usdToIdrRate };
    },
  );
}

// util pembulatan (opsional)
function roundTo(value: number, step: number) {
  // step: 100 -> bulat ke 100 rupiah
  return Math.ceil(value / step) * step;
}

function toCountFromFreePriceValue(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    return Number((value as { count?: unknown }).count ?? 0);
  }
  return Number(value ?? 0);
}

function normalizeFreePriceMap(
  rawMap: unknown,
  usdToIdrRate: number,
  profitMultiplier: number,
) {
  if (!rawMap || typeof rawMap !== "object") return undefined;

  const entries: Array<[string, { count: number; retail_price: number }]> = [];

  for (const [rawMaxPrice, rawValue] of Object.entries(rawMap as Record<string, unknown>)) {
    const maxPriceUsd = Number(rawMaxPrice);
    const stock = toCountFromFreePriceValue(rawValue);

    if (!Number.isFinite(maxPriceUsd) || maxPriceUsd <= 0) continue;
    if (!Number.isFinite(stock) || stock <= 0) continue;

    const retailFinal = maxPriceUsd * usdToIdrRate * profitMultiplier;
    entries.push([
      rawMaxPrice,
      {
        count: Math.floor(stock),
        retail_price: retailFinal,
      },
    ]);
  }

  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

export async function getTopCountriesByService(
  service: string,
  freePrice: boolean = true,
  options?: FetchOptions,
): Promise<HeroSmsTopCountryOffer[]> {
  const serviceCode = String(service ?? "").trim();
  if (!serviceCode) throw new HttpError(400, "Missing service");

  const cacheKey = `herosms:top-countries:${serviceCode}:${freePrice ? 1 : 0}`;

  return maybeCached(
    cacheKey,
    env.HEROSMS_TOP_COUNTRIES_CACHE_TTL_MS,
    options,
    async () => {
      const json = await heroGetJson({
        action: "getTopCountriesByService",
        service: serviceCode,
        freePrice: freePrice ? true : false,
      });

      if (!json || typeof json !== "object" || Array.isArray(json)) {
        const message =
          (json as any)?.message ||
          (json as any)?.error ||
          "Invalid top countries payload";
        throw new HttpError(502, `HeroSMS invalid payload: ${message}`);
      }

      const { profitPercent, usdToIdrRate } = await getPricingSettings();
      const profitMultiplier = 1 + profitPercent / 100;

      const baseOffers = Object.values(json as any).map((x: any) => {
        const retailUsd = Number(x.retail_price ?? 0);

        // TANPA BULATIN
        const retailFinal = retailUsd * usdToIdrRate * profitMultiplier;
        const normalizedFreePriceMap = normalizeFreePriceMap(
          x.freePriceMap,
          usdToIdrRate,
          profitMultiplier,
        );

        return {
          retail_price: retailFinal, // IDR final (float)
          country: Number(x.country ?? 0),
          freePriceMap: normalizedFreePriceMap,
          price: Number(x.price ?? 0),
          count: Number(x.count ?? 0),
        };
      });

      const countries = Array.from(
        new Set(
          baseOffers
            .map((o) => Number(o.country))
            .filter((country) => Number.isFinite(country) && country > 0),
        ),
      );

      if (countries.length === 0) return baseOffers;

      const customRows = await prisma.adminServiceCountryCustomPrice.findMany({
        where: {
          service: serviceCode,
          isActive: true,
          country: { in: countries },
        },
        select: { country: true, customPrice: true },
      });

      if (customRows.length === 0) return baseOffers;

      const customMap = new Map<number, number>();
      for (const row of customRows) {
        const price = Number(row.customPrice);
        if (Number.isFinite(price) && price > 0) {
          customMap.set(row.country, price);
        }
      }

      return baseOffers.map((offer) => {
        const customPrice = customMap.get(offer.country);
        if (!customPrice) {
          return { ...offer, retail_price_default: offer.retail_price };
        }

        return {
          ...offer,
          retail_price_default: offer.retail_price,
          retail_price: customPrice,
          custom_price: customPrice,
          is_custom_price: true,
        };
      });
    },
  );
}

/* =========================
  order
========================= */

export type HeroSmsOrderResult = {
  activationId: string;
  phoneNumber: string;
  activationCost?: number;
  activationTime?: Date;
  activationEndTime?: Date;
  country?: number;
  service?: string;
  raw?: any;
};

function parseActivationFromText(text: string): HeroSmsOrderResult | null {
  const t = (text || "").trim();
  const parts = t.split(":");
  // ACCESS_NUMBER:ACTIVATION_ID:PHONE_NUMBER
  if (parts.length >= 3 && parts[0] === "ACCESS_NUMBER") {
    return {
      activationId: String(parts[1]),
      phoneNumber: String(parts[2]),
      raw: t,
    };
  }
  return null;
}

export async function createOrder(
  service: string,
  country: number,
  maxPrice?: number,
): Promise<HeroSmsOrderResult> {
  if (!service) throw new HttpError(400, "Missing service");
  if (!Number.isFinite(country)) throw new HttpError(400, "Missing country");

  const useStrictPrice = Number.isFinite(maxPrice) && Number(maxPrice) > 0;

  // coba V2 dulu (JSON)
  try {
    const json = await heroGetJson({
      action: "getNumberV2",
      service,
      country,
      maxPrice: useStrictPrice ? maxPrice : undefined,
      fixedPrice: useStrictPrice ? "true" : undefined,
    });

    const activationId = String(
      (json as any).activationId ?? (json as any).id ?? "",
    );
    const phoneNumber = String(
      (json as any).phoneNumber ??
        (json as any).number ??
        (json as any).phone ??
        "",
    );

    if (!activationId || !phoneNumber)
      throw new Error("Invalid getNumberV2 payload");

    const activationWindow = getActivationWindow(json);

    return {
      activationId,
      phoneNumber,
      activationCost:
        (json as any).activationCost !== undefined
          ? Number((json as any).activationCost)
          : (json as any).cost !== undefined
            ? Number((json as any).cost)
            : undefined,
      activationTime: activationWindow.activationTime,
      activationEndTime: activationWindow.activationEndTime,
      country,
      service,
      raw: json,
    };
  } catch {
    // fallback V1 (text)
    if (!HEROSMS_API_KEY)
      throw new HttpError(500, "HEROSMS_API_KEY is not set");

    const url = buildHeroSmsUrl({
      api_key: HEROSMS_API_KEY,
      action: "getNumber",
      service,
      country,
      maxPrice: useStrictPrice ? maxPrice : undefined,
      fixedPrice: useStrictPrice ? "true" : undefined,
    });

    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    if (!res.ok)
      throw new HttpError(502, `HeroSMS error (${res.status}): ${text}`);

    const parsed = parseActivationFromText(text);
    if (!parsed) {
      // contoh: NO_NUMBERS, NO_BALANCE, BAD_SERVICE, dll
      throw new HttpError(502, `HeroSMS order failed: ${text}`);
    }

    return { ...parsed, country, service };
  }
}

export async function cancelActivation(activationId: string) {
  const id = String(activationId ?? "").trim();
  if (!id) throw new HttpError(400, "Missing activationId");

  const text = await heroGetText({
    action: "setStatus",
    id,
    status: 8,
  });

  const normalized = String(text ?? "").trim().toUpperCase();
  const ok =
    normalized === "ACCESS_CANCEL" ||
    normalized === "ACCESS_CANCEL_ALREADY" ||
    normalized === "STATUS_CANCEL";

  if (!ok) {
    throw new HttpError(502, `HeroSMS cancel failed: ${text}`);
  }

  return {
    activationId: id,
    raw: text,
  };
}

export async function completeActivation(activationId: string) {
  const id = String(activationId ?? "").trim();
  if (!id) throw new HttpError(400, "Missing activationId");

  const text = await heroGetText({
    action: "setStatus",
    id,
    status: 6,
  });

  const normalized = String(text ?? "").trim().toUpperCase();
  const ok =
    normalized === "ACCESS_ACTIVATION" ||
    normalized === "ACCESS_ACTIVATION_ALREADY" ||
    normalized === "STATUS_OK";

  if (!ok) {
    throw new HttpError(502, `HeroSMS complete failed: ${text}`);
  }

  return {
    activationId: id,
    raw: text,
  };
}
