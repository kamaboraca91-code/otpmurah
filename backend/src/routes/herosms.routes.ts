import { Router } from "express";
import { requireAuth } from "../middleware/requireUserAuth";
import { requireUserOrAdminAuth } from "../middleware/requireUserOrAdminAuth";
import {
  getCountries,
  getServiceList,
  getTopCountriesByService,
  createOrder,
  cancelActivation,
  getActivationStatus,
} from "../modules/herosms/herosms.client";
import { prisma } from "../prisma";
import { HttpError } from "../utils/errors";
import { toNumberOrderDto } from "../modules/numbers/numberOrders.service";
import { publishNumberEvent } from "../modules/numbers/numbersRealtime";
import { applyBalanceMutation } from "../modules/balance/balanceMutations.service";

const router = Router();

function toUsd(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toIdrFromUsd(usd: number, usdToIdrRate: number) {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  if (!Number.isFinite(usdToIdrRate) || usdToIdrRate <= 0) return 0;
  return Math.ceil(usd * usdToIdrRate);
}

function toFreePriceStock(value: unknown) {
  if (typeof value === "number") return Number(value);
  if (value && typeof value === "object") {
    return Number((value as { count?: unknown }).count ?? 0);
  }
  return Number(value ?? 0);
}

function toFreePriceRetail(value: unknown) {
  if (value && typeof value === "object") {
    return Number((value as { retail_price?: unknown }).retail_price ?? 0);
  }
  return Number.NaN;
}

function findFreePriceOption(
  freePriceMap: Record<string, unknown> | undefined,
  requestedMaxPrice: number,
) {
  if (!freePriceMap || typeof freePriceMap !== "object") return null;

  for (const [key, value] of Object.entries(freePriceMap)) {
    const candidateMaxPrice = Number(key);
    if (!Number.isFinite(candidateMaxPrice) || candidateMaxPrice <= 0) continue;
    if (Math.abs(candidateMaxPrice - requestedMaxPrice) > 1e-9) continue;

    return {
      maxPrice: candidateMaxPrice,
      stock: toFreePriceStock(value),
      retailPrice: toFreePriceRetail(value),
    };
  }

  return null;
}

function getSelectedFallbackWindow(
  offer: { price?: number; freePriceMap?: Record<string, unknown> },
  selectedMaxPriceUsd: number,
) {
  const map = offer?.freePriceMap;
  if (!map || typeof map !== "object") return null;

  const tiers = Object.keys(map)
    .map((key) => Number(key))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const selectedIndex = tiers.findIndex(
    (tier) => Math.abs(tier - selectedMaxPriceUsd) < 1e-9,
  );
  if (selectedIndex < 0) return null;

  const baseMin = Number(offer?.price ?? 0);
  const minExclusive =
    selectedIndex > 0
      ? tiers[selectedIndex - 1]
      : Number.isFinite(baseMin) && baseMin > 0
        ? baseMin
        : 0;

  return {
    minExclusive,
    maxInclusive: selectedMaxPriceUsd,
  };
}

function extractOrderCostUsd(value: unknown): number {
  const source = value as any;
  const candidates: unknown[] = [
    source?.activationCost,
    source?.cost,
    source?.price,
    source?.raw?.activationCost,
    source?.raw?.cost,
    source?.raw?.price,
    source?.raw?.data?.activationCost,
    source?.raw?.data?.cost,
    source?.raw?.data?.price,
    source?.raw?.response?.activationCost,
    source?.raw?.response?.cost,
    source?.raw?.response?.price,
    source?.raw?.result?.activationCost,
    source?.raw?.result?.cost,
    source?.raw?.result?.price,
    source?.raw?.getStatusV2?.activationCost,
    source?.raw?.getStatusV2?.cost,
    source?.raw?.getStatusV2?.price,
    source?.raw?.getStatusV2?.data?.activationCost,
    source?.raw?.getStatusV2?.data?.cost,
    source?.raw?.getStatusV2?.data?.price,
  ];

  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

/**
 * GET /api/herosms/services
 * Protected (user/admin)
 */
router.get("/services", requireUserOrAdminAuth, async (_req, res, next) => {
  try {
    const noCache = String(_req.query.noCache ?? "0") === "1";
    const services = await getServiceList({ bypassCache: noCache });
    return res.json({ ok: true, services });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/herosms/countries
 * Protected (user/admin)
 */
router.get("/countries", requireUserOrAdminAuth, async (_req, res, next) => {
  try {
    const noCache = String(_req.query.noCache ?? "0") === "1";
    const countries = await getCountries({ bypassCache: noCache });
    return res.json({ ok: true, countries });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/herosms/top-countries?service=wa&freePrice=1
 * Protected (user/admin)
 */
router.get("/top-countries", requireUserOrAdminAuth, async (req, res, next) => {
  try {
    const service = String(req.query.service ?? "").trim();
    if (!service) return res.status(400).json({ message: "Missing service" });

    const freePrice = String(req.query.freePrice ?? "1") !== "0";
    const noCache = String(req.query.noCache ?? "0") === "1";
    const offers = await getTopCountriesByService(service, freePrice, {
      bypassCache: noCache,
    });

    return res.json({ ok: true, offers });
  } catch (err) {
    next(err);
  }
});

// GET /api/herosms/order?service=fb&country=36&maxPrice=0.02
router.get("/order", requireAuth, async (req, res, next) => {
  try {
    const service = String(req.query.service ?? "").trim();
    const country = Number(req.query.country);
    const noCache = String(req.query.noCache ?? "0") === "1";

    const maxPriceRaw = req.query.maxPrice;
    const maxPrice =
      maxPriceRaw === undefined || maxPriceRaw === null || maxPriceRaw === ""
        ? undefined
        : Number(maxPriceRaw);

    if (!service) return res.status(400).json({ message: "Missing service" });
    if (!Number.isFinite(country))
      return res.status(400).json({ message: "Missing country" });
    if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice <= 0))
      return res.status(400).json({ message: "Invalid maxPrice" });

    const offers = await getTopCountriesByService(service, true, {
      bypassCache: noCache,
    });
    const [serviceList, countryList] = await Promise.all([
      getServiceList(),
      getCountries(),
    ]);
    const pricingSettings = await prisma.adminPricingSettings.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { usdToIdrRate: true },
    });
    const usdToIdrRate =
      Number(pricingSettings?.usdToIdrRate ?? 16000) > 0
        ? Number(pricingSettings?.usdToIdrRate ?? 16000)
        : 16000;
    const selectedOffer = offers.find((x) => Number(x.country) === country);
    const selectedService = serviceList.find((x) => x.code === service);
    const selectedCountry = countryList.find((x) => Number(x.id) === country);
    const serviceName = String(selectedService?.name ?? service).trim();
    const countryName = String(
      selectedCountry?.eng ??
      selectedCountry?.rus ??
      selectedCountry?.chn ??
      `Country ${country}`,
    ).trim();

    if (!selectedOffer) {
      throw new HttpError(400, "Negara tidak tersedia untuk layanan ini");
    }
    if (!Number.isFinite(selectedOffer.count) || selectedOffer.count <= 0) {
      throw new HttpError(400, "Stok nomor habis");
    }

    let selectedMaxPriceUsd: number | undefined;
    let selectedRetailPrice = Number(selectedOffer.retail_price);

    if (maxPrice !== undefined) {
      const selectedOption = findFreePriceOption(
        selectedOffer.freePriceMap as Record<string, unknown> | undefined,
        maxPrice,
      );

      if (!selectedOption) {
        throw new HttpError(400, "Opsi harga alternatif tidak valid");
      }
      if (!Number.isFinite(selectedOption.stock) || selectedOption.stock <= 0) {
        throw new HttpError(400, "Stok opsi harga habis");
      }
      if (!Number.isFinite(selectedOption.retailPrice) || selectedOption.retailPrice <= 0) {
        throw new HttpError(400, "Harga opsi alternatif tidak valid");
      }

      const currentRetailCeil = Math.ceil(Number(selectedOffer.retail_price));
      if (Math.ceil(selectedOption.retailPrice) <= currentRetailCeil) {
        throw new HttpError(400, "Opsi harga harus lebih tinggi dari harga utama");
      }

      selectedMaxPriceUsd = selectedOption.maxPrice;
      selectedRetailPrice = selectedOption.retailPrice;
    }

    const pricePaid = Math.ceil(selectedRetailPrice);
    if (!Number.isFinite(pricePaid) || pricePaid <= 0) {
      throw new HttpError(500, "Harga order tidak valid");
    }

    const debitResult = await applyBalanceMutation({
      userId: req.userId!,
      direction: "DEBIT",
      amount: pricePaid,
      type: "ORDER_DEBIT",
      referenceType: "NUMBER_ORDER",
      description: `Pembelian ${serviceName} - ${countryName}`,
      metadata: {
        service,
        serviceName,
        country,
        countryName,
        orderMode: selectedMaxPriceUsd ? "fallback" : "default",
        selectedMaxPriceUsd: selectedMaxPriceUsd ?? null,
        selectedRetailPrice: pricePaid,
      },
    });

    let providerOrder: Awaited<ReturnType<typeof createOrder>>;
    let providerCostUsd = 0;
    try {
      providerOrder = await createOrder(service, country, selectedMaxPriceUsd);
      providerCostUsd = extractOrderCostUsd(providerOrder);

      if (selectedMaxPriceUsd) {
        if (providerCostUsd <= 0) {
          try {
            const statusProbe = await getActivationStatus(
              String(providerOrder.activationId),
            );
            const statusRaw = statusProbe?.raw as any;
            providerCostUsd = extractOrderCostUsd({
              activationCost: statusRaw?.getStatusV2?.activationCost,
              raw: statusRaw,
            });
            providerOrder.raw = {
              ...(providerOrder.raw && typeof providerOrder.raw === "object"
                ? providerOrder.raw
                : { createOrderRaw: providerOrder.raw }),
              statusProbe: statusRaw ?? null,
            };
          } catch {
            // ignore; strict validation below will reject when cost remains unknown
          }
        }

        const selectedWindow = getSelectedFallbackWindow(
          {
            price: selectedOffer.price,
            freePriceMap: selectedOffer.freePriceMap as Record<string, unknown> | undefined,
          },
          selectedMaxPriceUsd,
        );

        if (selectedWindow && providerCostUsd > 0) {
          const eps = 1e-9;
          const tooLow = providerCostUsd <= selectedWindow.minExclusive + eps;
          const tooHigh = providerCostUsd > selectedWindow.maxInclusive + eps;

          if (tooLow || tooHigh) {
            try {
              await cancelActivation(String(providerOrder.activationId));
            } catch {
              // ignore cancel error; user tetap akan di-refund
            }

            throw new HttpError(
              409,
              "Provider mengembalikan harga di luar opsi yang dipilih. Silakan pilih opsi lain.",
            );
          }
        } else if (selectedWindow && providerCostUsd <= 0) {
          try {
            await cancelActivation(String(providerOrder.activationId));
          } catch {
            // ignore cancel error; user tetap akan di-refund
          }

          throw new HttpError(
            409,
            "Provider tidak mengembalikan detail harga fallback. Order dibatalkan otomatis.",
          );
        }
      }
    } catch (err) {
      await applyBalanceMutation({
        userId: req.userId!,
        direction: "CREDIT",
        amount: pricePaid,
        type: "ORDER_REFUND",
        referenceType: "NUMBER_ORDER",
        description: `Refund order gagal ${serviceName} - ${countryName}`,
        metadata: {
          service,
          serviceName,
          country,
          countryName,
          reason: "provider_order_failed",
          orderMode: selectedMaxPriceUsd ? "fallback" : "default",
          selectedMaxPriceUsd: selectedMaxPriceUsd ?? null,
        },
      });
      throw err;
    }

    const fallbackOfferUsd = toUsd(selectedOffer.price);
    const selectedOptionUsd = toUsd(selectedMaxPriceUsd);
    const effectiveCostUsd =
      providerCostUsd > 0
        ? providerCostUsd
        : selectedOptionUsd > 0
          ? selectedOptionUsd
          : fallbackOfferUsd;
    const estimatedBaseCost = toIdrFromUsd(effectiveCostUsd, usdToIdrRate);
    const profitAmount = pricePaid - estimatedBaseCost;

    const saved = await prisma.userNumberOrder.create({
      data: {
        userId: req.userId!,
        activationId: String(providerOrder.activationId),
        phoneNumber: String(providerOrder.phoneNumber),
        service,
        serviceName,
        country,
        countryName,
        pricePaid,
        profitAmount,
        status: "STATUS_WAIT_CODE",
        activationTime: providerOrder.activationTime,
        activationEndTime: providerOrder.activationEndTime,
        providerRaw: providerOrder.raw ?? undefined,
      },
    });

    await prisma.userBalanceMutation
      .update({
        where: { id: debitResult.mutation.id },
        data: {
          referenceId: saved.id,
          metadata: {
            service,
            serviceName,
            country,
            countryName,
            activationId: saved.activationId,
            phoneNumber: saved.phoneNumber,
            profitAmount,
            estimatedBaseCost,
            orderMode: selectedMaxPriceUsd ? "fallback" : "default",
            selectedMaxPriceUsd: selectedMaxPriceUsd ?? null,
          } as any,
        },
      })
      .catch(() => null);

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { balance: true },
    });

    const order = toNumberOrderDto(saved);
    publishNumberEvent(req.userId!, {
      type: "order_created",
      item: order,
      balance: user?.balance ?? 0,
    });

    return res.json({ ok: true, order, balance: user?.balance ?? 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
