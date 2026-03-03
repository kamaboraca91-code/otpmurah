import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { sileo } from "sileo";
import { createPortal } from "react-dom";
import { Icon, Button, Card, useModalPresence } from "../../components/ui";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */
type Service = { code: string; name: string };

type Country = {
  id: number;
  rus: string;
  eng: string;
  chn: string;
  visible: number;
  retry: number;
};

type Offer = {
  retail_price: number;
  retail_price_default?: number;
  retail_price_local?: number;
  country: number;
  freePriceMap?: Record<string, number | { count?: number; retail_price?: number }>;
  price: number;
  count: number;
};

type FallbackPriceOption = {
  key: string;
  maxPrice: number;
  stock: number;
  retailPrice: number;
};

type FallbackModalTrigger = "manual" | "stock-out";

const MOBILE_BREAKPOINT = "(max-width: 640px)";
const MOBILE_SERVICE_BATCH = 30;
const MOBILE_COUNTRY_BATCH = 24;
const DESKTOP_SERVICE_BATCH = 80;

/* ------------------------------------------------------------------ */
/*  UTILS                                                              */
/* ------------------------------------------------------------------ */
function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

async function apiJson(path: string, init?: RequestInit) {
  const result: any = await apiFetch(path, init ?? { method: "GET" });
  if (result && typeof result.json === "function") {
    const data = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(data?.message || "Request failed");
    return data;
  }
  const data = result ?? {};
  if (data?.message && data?.ok === false) throw new Error(data.message);
  return data;
}

function formatMoney(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(x);
}

function normalizeStockFromFreePriceValue(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    return Number((value as { count?: unknown }).count ?? 0);
  }
  return Number(value ?? 0);
}

function normalizeRetailPriceFromFreePriceValue(value: unknown) {
  if (value && typeof value === "object") {
    return Number((value as { retail_price?: unknown }).retail_price ?? 0);
  }
  return Number.NaN;
}

function parseFreePriceOptions(offer?: Offer | null, minExclusive?: number): FallbackPriceOption[] {
  if (!offer?.freePriceMap || typeof offer.freePriceMap !== "object") return [];
  const minLimit =
    Number.isFinite(minExclusive) && Number(minExclusive) > 0 ? Number(minExclusive) : null;
  const currentRetailPrice = Number(offer?.retail_price ?? 0);
  const currentRetailCeil =
    Number.isFinite(currentRetailPrice) && currentRetailPrice > 0
      ? Math.ceil(currentRetailPrice)
      : null;
  const baseRetailPrice = Number(offer?.retail_price_default ?? offer?.retail_price ?? 0);
  const baseUsdPrice = Number(offer?.price ?? 0);
  const inferredIdrPerUsd =
    Number.isFinite(baseRetailPrice) &&
      baseRetailPrice > 0 &&
      Number.isFinite(baseUsdPrice) &&
      baseUsdPrice > 0
      ? baseRetailPrice / baseUsdPrice
      : null;

  return Object.entries(offer.freePriceMap)
    .map(([key, value]) => {
      const maxPrice = Number(key);
      const mappedRetailPrice = normalizeRetailPriceFromFreePriceValue(value);
      const inferredRetailPrice =
        Number.isFinite(maxPrice) && maxPrice > 0 && inferredIdrPerUsd !== null
          ? maxPrice * inferredIdrPerUsd
          : Number.NaN;
      const retailPrice =
        Number.isFinite(mappedRetailPrice) && mappedRetailPrice > 0
          ? mappedRetailPrice
          : inferredRetailPrice;

      return {
        key,
        maxPrice,
        stock: normalizeStockFromFreePriceValue(value),
        retailPrice,
      };
    })
    .filter(
      (item) =>
        Number.isFinite(item.maxPrice) &&
        item.maxPrice > 0 &&
        Number.isFinite(item.stock) &&
        item.stock > 0 &&
        Number.isFinite(item.retailPrice) &&
        item.retailPrice > 0 &&
        (currentRetailCeil === null || Math.ceil(item.retailPrice) > currentRetailCeil) &&
        (minLimit === null || item.maxPrice > minLimit + 1e-9)
    )
    .sort((a, b) => a.maxPrice - b.maxPrice);
}

function isOutOfStockError(message: string) {
  const raw = String(message ?? "");
  const upper = raw.toUpperCase();
  if (upper.includes("NO_NUMBERS")) return true;
  if (/stok\s+nomor\s+habis/i.test(raw)) return true;
  if (/out\s*of\s*stock/i.test(raw)) return true;
  if (/stock\s+empty/i.test(raw)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/*  SKELETON LOADER                                                    */
/* ------------------------------------------------------------------ */
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-slate-200/70" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-3/4 rounded-md bg-slate-200/70" />
          <div className="h-2.5 w-1/2 rounded-md bg-slate-200/70" />
        </div>
      </div>
    </div>
  );
}

function SkeletonCountryRow() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-slate-200/70" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-2/5 rounded-md bg-slate-200/70" />
          <div className="h-3 w-1/4 rounded-md bg-slate-200/70" />
        </div>
        <div className="space-y-1.5 text-right">
          <div className="ml-auto h-3.5 w-20 rounded-md bg-slate-200/70" />
          <div className="ml-auto h-3 w-14 rounded-md bg-slate-200/70" />
        </div>
        <div className="h-9 w-20 rounded-lg bg-slate-200/70" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */
export default function OrderPage() {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const serviceRequestSeqRef = useRef(0);
  const countryRequestSeqRef = useRef(0);
  const serviceAbortRef = useRef<AbortController | null>(null);
  const countryAbortRef = useRef<AbortController | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Service | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const [countries, setCountries] = useState<Country[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [orderingId, setOrderingId] = useState<number | null>(null);
  const [fallbackModalOpen, setFallbackModalOpen] = useState(false);
  const [fallbackCountry, setFallbackCountry] = useState<Country | null>(null);
  const [fallbackOffer, setFallbackOffer] = useState<Offer | null>(null);
  const [fallbackOptions, setFallbackOptions] = useState<FallbackPriceOption[]>([]);
  const [fallbackOrderingPrice, setFallbackOrderingPrice] = useState<number | null>(null);
  const [fallbackModalTrigger, setFallbackModalTrigger] =
    useState<FallbackModalTrigger>("manual");
  const { mounted: fallbackModalMounted, isClosing: fallbackModalClosing } =
    useModalPresence(fallbackModalOpen);
  const [fallbackDrawerOffset, setFallbackDrawerOffset] = useState<number | null>(null);
  const [fallbackDrawerDragging, setFallbackDrawerDragging] = useState(false);
  const fallbackDrawerPointerIdRef = useRef<number | null>(null);
  const fallbackDrawerStartYRef = useRef<number | null>(null);
  const fallbackDrawerStartOffsetRef = useRef(0);
  const fallbackDrawerStartTsRef = useRef(0);
  const fallbackDrawerMovedRef = useRef(false);
  const fallbackDrawerIgnoreBackdropClickRef = useRef(false);
  const fallbackDrawerSnapTimerRef = useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_BREAKPOINT).matches
      : false
  );
  const [serviceLimit, setServiceLimit] = useState(
    isMobile ? MOBILE_SERVICE_BATCH : DESKTOP_SERVICE_BATCH
  );
  const [countryLimit, setCountryLimit] = useState(
    isMobile ? MOBILE_COUNTRY_BATCH : Number.MAX_SAFE_INTEGER
  );
  const deferredServiceQuery = useDeferredValue(serviceQuery);
  const deferredCountryQuery = useDeferredValue(countryQuery);

  /* ---------- data fetching ---------- */
  async function load(isRefresh = false) {
    const requestSeq = ++serviceRequestSeqRef.current;
    serviceAbortRef.current?.abort();
    const controller = new AbortController();
    serviceAbortRef.current = controller;

    try {
      setServiceError(null);
      setLoading(true);
      if (isRefresh) setRefreshing(true);

      if (isRefresh) {
        setSelected(null);
        setCountries([]);
        setOffers([]);
        setCountryError(null);
        setCountryQuery("");
        setFallbackModalOpen(false);
        setFallbackCountry(null);
        setFallbackOffer(null);
        setFallbackOptions([]);
        setFallbackModalTrigger("manual");
      }

      const data = await apiJson(
        isRefresh ? "/api/herosms/services?noCache=1" : "/api/herosms/services",
        { method: "GET", signal: controller.signal }
      );
      if (serviceRequestSeqRef.current !== requestSeq || controller.signal.aborted) return;
      setServices(Array.isArray(data?.services) ? data.services : []);
    } catch (e: any) {
      if (serviceRequestSeqRef.current !== requestSeq || controller.signal.aborted) return;
      setServiceError(e?.message || "Terjadi kesalahan");
    } finally {
      if (serviceRequestSeqRef.current !== requestSeq) return;
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadCountriesForService(serviceCode: string, noCache = false) {
    const requestSeq = ++countryRequestSeqRef.current;
    countryAbortRef.current?.abort();
    const controller = new AbortController();
    countryAbortRef.current = controller;

    try {
      setCountryError(null);
      setCountryLoading(true);
      const [cRes, oRes] = await Promise.all([
        apiJson(noCache ? "/api/herosms/countries?noCache=1" : "/api/herosms/countries", {
          method: "GET",
          signal: controller.signal,
        }),
        apiJson(
          `/api/herosms/top-countries?service=${encodeURIComponent(serviceCode)}&freePrice=1${noCache ? "&noCache=1" : ""}`,
          { method: "GET", signal: controller.signal }
        ),
      ]);
      if (countryRequestSeqRef.current !== requestSeq || controller.signal.aborted) return;
      setCountries(Array.isArray(cRes?.countries) ? cRes.countries : []);
      setOffers(Array.isArray(oRes?.offers) ? oRes.offers : []);
    } catch (e: any) {
      if (countryRequestSeqRef.current !== requestSeq || controller.signal.aborted) return;
      setCountryError(e?.message || "Gagal memuat negara");
      setCountries([]);
      setOffers([]);
    } finally {
      if (countryRequestSeqRef.current !== requestSeq) return;
      setCountryLoading(false);
    }
  }

  function openFallbackModalForCountry(
    countryId: number,
    showToast = false,
    trigger: FallbackModalTrigger = "manual"
  ) {
    const normalizedId = Number(countryId);
    const candidateOffer = offerByCountry.get(normalizedId) ?? null;
    const candidateCountry = countryById.get(normalizedId) ?? null;
    const alternatives = fallbackOptionsByCountry.get(normalizedId) ?? [];

    if (!candidateOffer || !candidateCountry || alternatives.length === 0) {
      if (showToast) {
        sileo.info({
          title: "Tidak ada opsi harga lain",
          description: "untuk negara ini tidak memiliki opsi aktif.",
          position: "top-center",
        });
      }
      return false;
    }

    setFallbackCountry(candidateCountry);
    setFallbackOffer(candidateOffer);
    setFallbackOptions(alternatives);
    setFallbackModalTrigger(trigger);
    setFallbackModalOpen(true);

    // if (showToast) {
    //   sileo.info({
    //     title: "Pilih harga alternatif",
    //     description: "Silakan pilih opsi harga lain",
    //     position: "top-center",
    //   });
    // }

    return true;
  }

  async function handleOrder(
    countryId: number,
    maxPrice?: number,
    source: "default" | "fallback" = "default"
  ) {
    if (!selected) return;

    try {
      if (source === "default") {
        setOrderingId(countryId);
      }
      if (source === "fallback") {
        setFallbackOrderingPrice(maxPrice ?? null);
      }

      const params = new URLSearchParams({
        service: selected.code,
        country: String(countryId),
      });
      if (maxPrice !== undefined && Number.isFinite(maxPrice) && maxPrice > 0) {
        params.set("maxPrice", String(maxPrice));
      }

      const data = await apiJson(`/api/herosms/order?${params.toString()}`, { method: "GET" });

      const order = data?.order;
      if (!order?.activationId || !order?.phoneNumber) {
        throw new Error("Order response invalid");
      }

      sileo.success({
        title: "Order berhasil",
        description: (() => {
          if (!maxPrice || maxPrice <= 0) {
            return `Nomor ${order.phoneNumber} siap dipantau`;
          }
          const selectedFallbackOption =
            source === "fallback"
              ? fallbackOptions.find(
                (option) => Math.abs(Number(option.maxPrice) - Number(maxPrice)) < 1e-9
              )
              : null;
          if (selectedFallbackOption?.retailPrice) {
            return `Nomor ${order.phoneNumber} berhasil dibeli via opsi ${formatMoney(selectedFallbackOption.retailPrice)}`;
          }
          return `Nomor ${order.phoneNumber} berhasil dibeli via opsi harga alternatif`;
        })(),
        position: "top-center",
      });

      setFallbackModalOpen(false);
      setFallbackCountry(null);
      setFallbackOffer(null);
      setFallbackOptions([]);
      navigate("/numbers");
    } catch (e: any) {
      const message = e?.message || "Unknown error";

      if (source === "default" && isOutOfStockError(message)) {
        const opened = openFallbackModalForCountry(countryId, false, "stock-out");
        if (opened) {
          sileo.info({
            title: "Stok harga utama habis",
            description: "Silakan pilih opsi harga lain",
            position: "top-center",
          });
          return;
        }
      }

      if (/saldo tidak cukup/i.test(message)) {
        sileo.error({
          title: "Saldo tidak cukup",
          description: "Isi saldo terlebih dahulu untuk membeli layanan.",
          position: "top-center",
        });
      } else {
        sileo.error({
          title: "Order gagal",
          description: message,
          position: "top-center",
        });
      }
    } finally {
      if (source === "default") {
        setOrderingId(null);
      }
      if (source === "fallback") {
        setFallbackOrderingPrice(null);
      }
    }
  }

  function handleSelectService(service: Service) {
    setSelected(service);
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  useEffect(() => {
    load(false);
  }, []);

  useEffect(
    () => () => {
      serviceAbortRef.current?.abort();
      countryAbortRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(MOBILE_BREAKPOINT);
    const onChange = () => setIsMobile(media.matches);

    onChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    // Safari fallback
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!selected?.code) {
      setCountries([]);
      setOffers([]);
      setCountryError(null);
      setCountryLoading(false);
      setFallbackModalOpen(false);
      setFallbackCountry(null);
      setFallbackOffer(null);
      setFallbackOptions([]);
      setFallbackModalTrigger("manual");
      return;
    }
    setCountryQuery("");
    setFallbackModalOpen(false);
    setFallbackCountry(null);
    setFallbackOffer(null);
    setFallbackOptions([]);
    setFallbackModalTrigger("manual");
    loadCountriesForService(selected.code);
  }, [selected?.code]);

  useEffect(() => {
    if (!fallbackModalMounted) return;
    const prev = document.body.style.overflow;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fallbackModalOpen && fallbackOrderingPrice === null) {
        setFallbackModalOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onEsc);
    };
  }, [fallbackModalMounted, fallbackModalOpen, fallbackOrderingPrice]);

  useEffect(() => {
    setServiceLimit(isMobile ? MOBILE_SERVICE_BATCH : DESKTOP_SERVICE_BATCH);
  }, [isMobile, deferredServiceQuery]);

  useEffect(() => {
    setCountryLimit(isMobile ? MOBILE_COUNTRY_BATCH : Number.MAX_SAFE_INTEGER);
  }, [isMobile, deferredCountryQuery, selected?.code]);

  /* ---------- derived data ---------- */
  const filteredServices = useMemo(() => {
    const t = deferredServiceQuery.trim().toLowerCase();
    if (!t) return services;
    return services.filter(
      (s) => s.name.toLowerCase().includes(t) || s.code.toLowerCase().includes(t)
    );
  }, [deferredServiceQuery, services]);

  const offerByCountry = useMemo(() => {
    const m = new Map<number, Offer>();
    offers.forEach((o) => m.set(o.country, o));
    return m;
  }, [offers]);

  const countryById = useMemo(() => {
    const m = new Map<number, Country>();
    countries.forEach((c) => m.set(c.id, c));
    return m;
  }, [countries]);

  const fallbackOptionsByCountry = useMemo(() => {
    const m = new Map<number, FallbackPriceOption[]>();
    offers.forEach((offer) => {
      m.set(
        Number(offer.country),
        parseFreePriceOptions(offer, Number(offer?.price ?? 0))
      );
    });
    return m;
  }, [offers]);

  const countryRows = useMemo(() => {
    const t = deferredCountryQuery.trim().toLowerCase();
    const rows = countries
      .filter((c) => c.visible === 1)
      .map((c) => ({ c, o: offerByCountry.get(c.id) }))
      .filter((x) => x.o && (x.o.count ?? 0) > 0);

    const filtered = !t
      ? rows
      : rows.filter(({ c }) => {
        const eng = (c.eng ?? "").toLowerCase();
        const rus = (c.rus ?? "").toLowerCase();
        const chn = (c.chn ?? "").toLowerCase();
        return eng.includes(t) || rus.includes(t) || chn.includes(t) || String(c.id).includes(t);
      });

    return filtered.sort((a, b) => (b.o!.count ?? 0) - (a.o!.count ?? 0));
  }, [countries, offerByCountry, deferredCountryQuery]);

  const totalStock = useMemo(
    () => countryRows.reduce((s, r) => s + (r.o?.count ?? 0), 0),
    [countryRows]
  );

  const visibleServices = useMemo(
    () => filteredServices.slice(0, serviceLimit),
    [filteredServices, serviceLimit]
  );

  const visibleCountryRows = useMemo(
    () => (isMobile ? countryRows.slice(0, countryLimit) : countryRows),
    [countryRows, countryLimit, isMobile]
  );

  const hasMoreServices = visibleServices.length < filteredServices.length;
  const hasMoreCountries = isMobile && visibleCountryRows.length < countryRows.length;

  function clearFallbackDrawerSnapTimer() {
    if (fallbackDrawerSnapTimerRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(fallbackDrawerSnapTimerRef.current);
    fallbackDrawerSnapTimerRef.current = null;
  }

  function resetFallbackDrawerDragState() {
    setFallbackDrawerDragging(false);
    setFallbackDrawerOffset(null);
    fallbackDrawerPointerIdRef.current = null;
    fallbackDrawerStartYRef.current = null;
    fallbackDrawerStartOffsetRef.current = 0;
    fallbackDrawerStartTsRef.current = 0;
    fallbackDrawerMovedRef.current = false;
    fallbackDrawerIgnoreBackdropClickRef.current = false;
  }

  function handleFallbackDrawerPointerDown(event: any) {
    if (!isMobile || fallbackOrderingPrice !== null || fallbackModalClosing) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    clearFallbackDrawerSnapTimer();
    fallbackDrawerPointerIdRef.current = event.pointerId;
    fallbackDrawerStartYRef.current = Number(event.clientY ?? 0);
    fallbackDrawerStartOffsetRef.current = Number(fallbackDrawerOffset ?? 0);
    fallbackDrawerStartTsRef.current = performance.now();
    fallbackDrawerMovedRef.current = false;
    setFallbackDrawerDragging(true);
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  }

  function handleFallbackDrawerPointerMove(event: any) {
    if (!fallbackDrawerDragging) return;
    if (fallbackDrawerPointerIdRef.current !== event.pointerId) return;

    const startY = fallbackDrawerStartYRef.current ?? Number(event.clientY ?? 0);
    const startOffset = fallbackDrawerStartOffsetRef.current;
    const currentY = Number(event.clientY ?? startY);
    const delta = currentY - startY;

    // Offset > 0: drawer mengecil. Offset 0: ukuran normal.
    const nextOffset = Math.max(0, startOffset + delta);

    if (Math.abs(delta) > 4) fallbackDrawerMovedRef.current = true;
    if (Math.abs(delta) > 6) event.preventDefault();
    setFallbackDrawerOffset(nextOffset);
  }

  function finishFallbackDrawerPointerInteraction(event: any) {
    if (!fallbackDrawerDragging) return;
    if (fallbackDrawerPointerIdRef.current !== event.pointerId) return;

    event.currentTarget?.releasePointerCapture?.(event.pointerId);

    const startY = fallbackDrawerStartYRef.current ?? Number(event.clientY ?? 0);
    const endY = Number(event.clientY ?? startY);
    const delta = endY - startY;
    const elapsedMs = Math.max(16, performance.now() - fallbackDrawerStartTsRef.current);
    const velocity = delta / elapsedMs;
    const currentOffset = Number(fallbackDrawerOffset ?? 0);
    const closeThresholdPx = Math.min(220, Math.max(120, window.innerHeight * 0.22));
    const shouldCloseByDistance = currentOffset > closeThresholdPx;
    const shouldCloseByVelocity = velocity > 1.15;
    const shouldClose = shouldCloseByDistance || shouldCloseByVelocity;
    const moved = fallbackDrawerMovedRef.current;

    fallbackDrawerIgnoreBackdropClickRef.current = moved;

    setFallbackDrawerDragging(false);
    fallbackDrawerPointerIdRef.current = null;
    fallbackDrawerStartYRef.current = null;
    fallbackDrawerStartOffsetRef.current = 0;
    fallbackDrawerStartTsRef.current = 0;
    fallbackDrawerMovedRef.current = false;

    if (shouldClose && fallbackOrderingPrice === null) {
      setFallbackDrawerOffset(null);
      setFallbackModalOpen(false);
      return;
    }

    setFallbackDrawerOffset(0);
    if (typeof window === "undefined") return;
    fallbackDrawerSnapTimerRef.current = window.setTimeout(() => {
      setFallbackDrawerOffset(null);
      fallbackDrawerSnapTimerRef.current = null;
    }, 280);
  }

  useEffect(() => {
    if (!fallbackModalOpen || !isMobile) {
      clearFallbackDrawerSnapTimer();
      resetFallbackDrawerDragState();
    }
    return () => {
      clearFallbackDrawerSnapTimer();
    };
  }, [fallbackModalOpen, isMobile]);

  /* ---------- Fallback Modal / Mobile Drawer ---------- */
  const fallbackModalTitle =
    fallbackModalTrigger === "stock-out" ? "Stok harga utama sedang habis" : "Pilih harga lain";
  const isFallbackStockOut = fallbackModalTrigger === "stock-out";

  const fallbackModalInnerContent =
    fallbackCountry && fallbackOffer ? (
      <>
        <div
          className={cn(
            "ui-modal-header border-b border-slate-100/80 dark:border-slate-700",
            isMobile ? "cursor-grab touch-none select-none px-4 pb-3 pt-2.5 active:cursor-grabbing" : "px-5 py-4",
            isFallbackStockOut
              ? "bg-gradient-to-r from-amber-50/80 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/30"
              : "bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/30"
          )}
          onPointerDown={isMobile ? handleFallbackDrawerPointerDown : undefined}
          onPointerMove={isMobile ? handleFallbackDrawerPointerMove : undefined}
          onPointerUp={isMobile ? finishFallbackDrawerPointerInteraction : undefined}
          onPointerCancel={isMobile ? finishFallbackDrawerPointerInteraction : undefined}
        >
          {isMobile ? (
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300/80 dark:bg-slate-600/80" />
          ) : null}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg",
                isFallbackStockOut
                  ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/25"
                  : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25"
              )}
            >
              <Icon
                name={isFallbackStockOut ? "warning" : "info"}
                className="h-5 w-5 text-white"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {fallbackModalTitle}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
                Opsi harga untuk{" "}
                <span className="font-bold text-slate-700 dark:text-slate-100">{selected?.name}</span> di{" "}
                <span className="font-bold text-slate-700 dark:text-slate-100">{fallbackCountry.eng}</span>
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "overflow-y-auto scrollbar-thin dark:text-slate-200",
            isMobile ? "max-h-[62dvh] px-4 pb-4 pt-3" : "max-h-[420px] p-5"
          )}
        >
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50/80 px-2 py-2.5 dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/70">
              <Icon name="iconify:solar:tag-price-bold-duotone" className="h-4 w-4 text-slate-500 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Harga Termurah saat ini</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {formatMoney(fallbackOffer.retail_price)}
              </p>
            </div>
          </div>

          {fallbackOptions.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100 shadow-inner dark:border-slate-700 dark:from-slate-800 dark:to-slate-700">
                <Icon
                  name="iconify:solar:inbox-line-bold-duotone"
                  className="h-6 w-6 text-slate-300 dark:text-slate-400"
                />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-300">Tidak ada opsi fallback</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {fallbackOptions.map((option) => {
                const isProcessing = fallbackOrderingPrice === option.maxPrice;
                return (
                  <div
                    key={option.key}
                    className={cn(
                      "group rounded-xl border bg-white px-2 py-2.5 transition-all duration-200 dark:bg-slate-900",
                      isProcessing
                        ? "border-emerald-300 bg-emerald-50/30 shadow-sm dark:border-emerald-600/50 dark:bg-emerald-950/20"
                        : "border-slate-200/80 hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-slate-600"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200/50 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-900/20">
                        <Icon
                          name="iconify:solar:tag-price-bold-duotone"
                          className="h-5 w-5 text-emerald-600 dark:text-emerald-300"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {formatMoney(option.retailPrice)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300">
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full",
                              option.stock > 100
                                ? "bg-emerald-400"
                                : option.stock > 10
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                            )}
                          />
                          <span className="font-semibold text-slate-600 dark:text-slate-200">
                            {option.stock.toLocaleString()}
                          </span>{" "}
                          pcs
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={fallbackOrderingPrice !== null}
                        isLoading={isProcessing}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOrder(fallbackCountry.id, option.maxPrice, "fallback");
                        }}
                        leftIcon="iconify:solar:cart-large-minimalistic-bold-duotone"
                        className="!h-9 !text-xs !font-bold"
                      >
                        {isProcessing ? "Ordering..." : "Order"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className={cn(
            "ui-modal-footer flex items-center gap-2 border-t border-slate-100/80 bg-slate-50/30 dark:border-slate-700",
            isMobile ? "justify-stretch px-4 pt-3" : "justify-end px-5 py-3.5"
          )}
          style={
            isMobile
              ? { paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }
              : undefined
          }
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={fallbackOrderingPrice !== null}
            onClick={() => setFallbackModalOpen(false)}
            className={cn("!h-9 !text-xs !font-semibold", isMobile && "w-full")}
          >
            Tutup
          </Button>
        </div>
      </>
    ) : null;

  const fallbackBackdropStyle =
    isMobile && fallbackDrawerOffset !== null
      ? {
        opacity: Math.max(0.2, 1 - Math.max(0, fallbackDrawerOffset) / 340),
      }
      : undefined;

  const fallbackDrawerShrinkPx = Math.max(0, Number(fallbackDrawerOffset ?? 0));
  const fallbackDrawerMaxShrinkPx =
    typeof window !== "undefined" ? Math.floor(window.innerHeight * 0.7) : 560;
  const fallbackDrawerClampedShrinkPx = Math.min(fallbackDrawerShrinkPx, fallbackDrawerMaxShrinkPx);

  const fallbackDrawerStyle =
    isMobile && fallbackDrawerOffset !== null
      ? {
        height: `calc(86dvh - ${fallbackDrawerClampedShrinkPx}px)`,
        maxHeight: `calc(86dvh - ${fallbackDrawerClampedShrinkPx}px)`,
        transition: fallbackDrawerDragging
          ? "none"
          : "height 320ms cubic-bezier(0.32, 0.72, 0, 1), max-height 320ms cubic-bezier(0.32, 0.72, 0, 1)",
      }
      : undefined;

  const fallbackModalContent =
    fallbackModalMounted && fallbackModalInnerContent ? (
      <div className={cn("fixed inset-0 z-[1000]", fallbackModalClosing && "pointer-events-none")}>
        <button
          type="button"
          onClick={() => {
            if (isMobile && fallbackDrawerIgnoreBackdropClickRef.current) {
              fallbackDrawerIgnoreBackdropClickRef.current = false;
              return;
            }
            if (fallbackOrderingPrice !== null) return;
            setFallbackModalOpen(false);
          }}
          className={cn(
            "absolute inset-0 bg-slate-950/50 backdrop-blur-sm dark:bg-black/70",
            fallbackModalClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
          )}
          style={fallbackBackdropStyle}
          aria-label="Close modal"
        />

        {isMobile ? (
          <div className="absolute inset-x-0 bottom-0 z-10">
            <div
              className={cn(
                "ui-modal-surface w-full rounded-t-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40",
                "max-h-[86dvh] overflow-hidden",
                fallbackModalClosing ? "fallback-sheet-exit" : "fallback-sheet-enter"
              )}
              style={fallbackDrawerStyle}
            >
              {fallbackModalInnerContent}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
            <div
              className={cn(
                "ui-modal-surface w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40",
                fallbackModalClosing ? "modal-panel-exit" : "modal-panel-enter"
              )}
            >
              {fallbackModalInnerContent}
            </div>
          </div>
        )}
      </div>
    ) : null;

  const fallbackModalLayer =
    fallbackModalContent && typeof document !== "undefined"
      ? createPortal(fallbackModalContent, document.body)
      : null;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-12">
      {/* ========== LEFT — Services ========== */}
      <div className="min-w-0 lg:col-span-5">
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                  <Icon name="iconify:solar:star-shine-bold-duotone" className="h-4.5 w-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-800">Pilih Layanan</h2>
                  <p className="truncate text-[11px] text-slate-400">
                    {loading
                      ? "Memuat layanan..."
                      : `${services.length} layanan tersedia`}
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => load(true)}
                disabled={refreshing || loading}
                className="!h-8 gap-1.5 !text-[11px] !font-semibold"
              >
                <span className="flex gap-1">
                  <Icon
                    name="iconify:solar:refresh-bold"
                    className={cn("h-3.5 w-3.5 mt-[1px]", (refreshing || loading) && "animate-spin")}
                  />
                  Refresh
                </span>
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="border-b border-slate-100/80 px-5 py-3">
            <div className="relative group">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                 <Icon name="search" className="h-5 w-5 mb-[3px]" />
              </span>
              <input
                value={serviceQuery}
                onChange={(e) => setServiceQuery(e.target.value)}
                placeholder="Cari layanan (fb, wa, telegram...)"
                className="w-full h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-10 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm"
              />
              {serviceQuery && (
                <button
                  onClick={() => setServiceQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <Icon name="iconify:solar:close-circle-bold" className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            {loading || refreshing ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : serviceError ? (
              <div className="rounded-xl border border-rose-200/60 bg-gradient-to-br from-rose-50/80 to-orange-50/50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-red-500 shadow-lg shadow-rose-500/20">
                    <Icon name="warning" className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-rose-800">Gagal memuat layanan</p>
                    <p className="mt-0.5 text-xs text-rose-600/80">{serviceError}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => load(false)}
                      className="mt-3 !h-8 gap-1.5 !text-[11px] !font-semibold"
                    >
                      <Icon name="iconify:solar:refresh-bold" className="h-3.5 w-3.5" />
                      Coba lagi
                    </Button>
                  </div>
                </div>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                  <Icon name="search" className="h-6 w-6 text-slate-300" />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">
                  Tidak ada layanan ditemukan
                </p>
                <p className="mt-1 text-xs text-slate-400">Coba ubah kata kunci pencarian Anda.</p>
                {serviceQuery && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setServiceQuery("")}
                    className="mt-3 !h-8 gap-1.5 !text-[11px]"
                  >
                    <Icon name="iconify:solar:close-circle-bold" className="h-3.5 w-3.5" />
                    Reset Pencarian
                  </Button>
                )}
              </div>
            ) : (
              <div className="max-h-[540px] overflow-x-hidden overflow-y-auto pr-1 scrollbar-thin">
                {/* Result count */}
                {serviceQuery && (
                  <p className="mb-3 text-[11px] text-slate-400">
                    <span className="font-bold text-slate-600">{filteredServices.length}</span> hasil
                    ditemukan
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleServices.map((s, idx) => {
                    const isSelected = selected?.code === s.code;
                    const iconUrl = `https://cdn.hero-sms.com/assets/img/service/${s.code}0.webp`;

                    return (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() => handleSelectService(s)}
                        style={
                          isMobile
                            ? undefined
                            : { animationDelay: `${Math.min(idx * 25, 250)}ms` }
                        }
                        className={cn(
                          "group relative w-full cursor-pointer overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-all duration-200",
                          !isMobile && "animate-[fadeSlideIn_0.3s_ease_both]",
                          isSelected
                            ? "border-emerald-400/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/30"
                            : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/50 active:scale-[0.97]"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
                            <svg
                              className="h-3 w-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200",
                              isSelected
                                ? "border-emerald-200 bg-white shadow-sm"
                                : "border-slate-200 bg-slate-50 group-hover:bg-white group-hover:shadow-sm"
                            )}
                          >
                            <img
                              src={iconUrl}
                              alt={s.name}
                              className="h-5 w-5"
                              width={20}
                              height={20}
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                              onError={(e) => {
                                const img = e.currentTarget;
                                img.style.display = "none";
                                const parent = img.parentElement;
                                if (parent && !parent.querySelector("[data-fallback]")) {
                                  const span = document.createElement("span");
                                  span.setAttribute("data-fallback", "1");
                                  span.className = cn(
                                    "text-[10px] font-bold",
                                    isSelected ? "text-emerald-700" : "text-slate-500"
                                  );
                                  span.textContent = (
                                    s.name?.slice(0, 2) ||
                                    s.code ||
                                    "?"
                                  ).toUpperCase();
                                  parent.appendChild(span);
                                }
                              }}
                            />
                          </div>
                          <p
                            className={cn(
                              "min-w-0 truncate text-xs font-bold transition-colors duration-200",
                              isSelected
                                ? "text-emerald-800"
                                : "text-slate-700 group-hover:text-slate-900"
                            )}
                          >
                            {s.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {hasMoreServices && (
                  <div className="mt-3 flex justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setServiceLimit((prev) =>
                          prev + (isMobile ? MOBILE_SERVICE_BATCH : DESKTOP_SERVICE_BATCH)
                        )
                      }
                      className="!h-9 !px-4 !text-[11px] !font-semibold"
                    >
                      Tampilkan lebih banyak ({filteredServices.length - visibleServices.length})
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ========== RIGHT — Panel Order ========== */}
      <div ref={panelRef} className="min-w-0 lg:col-span-7">
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card className="!p-0 overflow-hidden border-0 shadow-sm">
            {/* Header */}
            <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                    <Icon
                      name="iconify:solar:cart-large-minimalistic-bold-duotone"
                      className="h-4.5 w-4.5 text-white"
                    />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Panel Order</h2>
                    <p className="text-[11px] text-slate-400">
                      {selected ? (
                        <>
                          Layanan:{" "}
                          <span className="font-bold text-emerald-600">{selected.name}</span>
                        </>
                      ) : (
                        "Pilih layanan terlebih dahulu"
                      )}
                    </p>
                  </div>
                </div>
                {selected && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5">
              {!selected ? (
                /* ---------- EMPTY STATE ---------- */
                <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/80 to-white py-16 text-center">
                  <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                    <Icon
                      name="iconify:solar:box-minimalistic-bold-duotone"
                      className="h-8 w-8 text-slate-300"
                    />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-600">
                    Belum ada layanan dipilih
                  </h3>
                  <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-400">
                    Pilih layanan dari daftar di sebelah kiri untuk melihat negara dan harga yang
                    tersedia.
                  </p>
                  <div className="mt-5 flex items-center gap-2 text-slate-300">
                    <span className="h-px w-8 bg-slate-200" />
                    <Icon name="iconify:solar:globe-bold-duotone" className="h-4 w-4" />
                    <span className="h-px w-8 bg-slate-200" />
                  </div>
                </div>
              ) : countryLoading ? (
                /* ---------- LOADING ---------- */
                <div className="space-y-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCountryRow key={i} />
                  ))}
                </div>
              ) : countryError ? (
                /* ---------- ERROR ---------- */
                <div className="rounded-xl border border-rose-200/60 bg-gradient-to-br from-rose-50/80 to-orange-50/50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-red-500 shadow-lg shadow-rose-500/20">
                      <Icon name="warning" className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-rose-800">Gagal memuat negara</p>
                      <p className="mt-0.5 text-xs text-rose-600/80">{countryError}</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon="iconify:solar:refresh-bold"
                        onClick={() => selected && loadCountriesForService(selected.code, true)}
                        className="mt-3 !h-8 gap-2 !text-[11px] !font-semibold"
                      >
                        Coba lagi
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ---------- COUNTRY LIST ---------- */
                <>
                  {/* Search country */}
                  <div className="relative group mb-4">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                      <Icon name="search" className="h-5 w-5 mb-[3px]" />
                    </span>
                    <input
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                      placeholder="Cari negara (Indonesia, Russia, 36...)"
                      className="w-full h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-10 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm"
                    />
                    {countryQuery && (
                      <button
                        onClick={() => setCountryQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                      >
                        <Icon name="iconify:solar:close-circle-bold" className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Summary badges */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/50 sm:text-[11px]">
                      <Icon name="iconify:solar:globe-bold-duotone" className="h-3 w-3" />
                      {countryRows.length} negara
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/50 sm:text-[11px]">
                      <Icon
                        name="iconify:solar:box-minimalistic-bold-duotone"
                        className="h-3 w-3"
                      />
                      {totalStock.toLocaleString()} total stock
                    </span>
                    {countryQuery && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/50 sm:text-[11px]">
                        <Icon name="search" className="h-3 w-3" />
                        {countryRows.length} hasil
                      </span>
                    )}
                  </div>

                  {countryRows.length === 0 ? (
                    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                        <Icon
                          name="iconify:solar:globe-bold-duotone"
                          className="h-6 w-6 text-slate-300"
                        />
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-500">
                        Tidak ada negara tersedia
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Coba ubah kata kunci pencarian.
                      </p>
                      {countryQuery && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setCountryQuery("")}
                          className="mt-3 !h-8 gap-1.5 !text-[11px]"
                        >
                          <Icon name="iconify:solar:close-circle-bold" className="h-3.5 w-3.5" />
                          Reset Pencarian
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[520px] space-y-2 overflow-x-hidden overflow-y-auto pr-0.5 sm:pr-1 scrollbar-thin">
                      {visibleCountryRows.map(({ c, o }, idx) => {
                        const iconUrl = `https://cdn.hero-sms.com/assets/img/country/${c.id}.svg`;
                        const cheapestPrice = o!.retail_price;
                        const isOrdering = orderingId === c.id;
                        const isFallbackOrdering = fallbackOrderingPrice !== null;
                        const hasFallbackAlternatives =
                          (fallbackOptionsByCountry.get(Number(c.id))?.length ?? 0) > 0;

                        return (
                          <div
                            key={c.id}
                            style={
                              isMobile
                                ? undefined
                                : { animationDelay: `${Math.min(idx * 35, 350)}ms` }
                            }
                            className={cn(
                              "group rounded-xl border transition-all duration-200",
                              !isMobile && "animate-[fadeSlideIn_0.35s_ease_both]",
                              isOrdering
                                ? "border-emerald-300 bg-emerald-50/20 shadow-sm"
                                : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/30"
                            )}
                          >
                            <div className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3.5">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                {/* Country flag */}
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
                                  <img
                                    src={iconUrl}
                                    alt={c.eng}
                                    className="h-6 w-6 rounded-sm object-cover"
                                    width={24}
                                    height={24}
                                    loading="lazy"
                                    decoding="async"
                                    fetchPriority="low"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                </div>

                                {/* Country info */}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold text-slate-800">
                                    {c.eng}
                                  </p>
                                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                    <span
                                      className={cn(
                                        "inline-block h-1.5 w-1.5 rounded-full",
                                        o!.count > 100
                                          ? "bg-emerald-400"
                                          : o!.count > 10
                                            ? "bg-amber-400"
                                            : "bg-rose-400"
                                      )}
                                    />
                                    <span className="font-semibold text-slate-600">
                                      {o!.count.toLocaleString()}
                                    </span>{" "}
                                    pcs
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-between gap-2 sm:gap-3">
                                {/* Price */}
                                <button
                                  type="button"
                                  disabled={isOrdering}
                                  onClick={() =>
                                    openFallbackModalForCountry(c.id, true, "manual")
                                  }
                                  className={cn(
                                    "group/price relative rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-1.5 text-left transition-all duration-200 sm:min-w-[120px] sm:flex-none sm:text-right",
                                    !isOrdering
                                      ? "cursor-pointer hover:bg-blue-50/80 hover:shadow-sm"
                                      : "cursor-not-allowed opacity-80"
                                  )}
                                >
                                  <span className="text-sm font-bold flex gap-1 text-slate-800">
                                    <Icon
                                      name="iconify:solar:tag-bold"
                                      className="h-3.5 w-3.5"
                                    />
                                    {formatMoney(cheapestPrice)}
                                    <Icon
                                      name="iconify:mingcute:down-fill"
                                      className="h-3.5 w-3.5 mt-[5px] "
                                    />
                                  </span>


                                  {/* Tooltip desktop */}
                                  <span
                                    className={cn(
                                      "pointer-events-none absolute right-full mr-2 top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-xl transition-all duration-200 sm:block",
                                      hasFallbackAlternatives ? "bg-slate-800" : "bg-slate-600",
                                      "opacity-0 scale-95 group-hover/price:opacity-100 group-hover/price:scale-100"
                                    )}
                                  >
                                    {hasFallbackAlternatives
                                      ? "Klik untuk opsi harga lain"
                                      : "Tidak ada harga alternatif"}
                                  </span>
                                </button>

                                {/* Order button */}
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleOrder(c.id)}
                                  disabled={isOrdering || isFallbackOrdering}
                                  isLoading={isOrdering}
                                  leftIcon="iconify:solar:cart-large-minimalistic-bold-duotone"
                                  className="!h-9 !min-w-[96px] !px-3 !text-xs !font-bold sm:!min-w-[102px]"
                                >
                                  {isOrdering ? "Ordering..." : "Order"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {hasMoreCountries && (
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setCountryLimit((prev) => prev + MOBILE_COUNTRY_BATCH)
                            }
                            className="w-full !h-9 !text-[11px] !font-semibold"
                          >
                            Tampilkan lebih banyak ({countryRows.length - visibleCountryRows.length})
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {fallbackModalLayer}

      {/* ========== GLOBAL KEYFRAMES ========== */}
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fallbackSheetIn {
          from {
            opacity: 0.96;
            transform: translate3d(0, 100%, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes fallbackSheetOut {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
          to {
            opacity: 0.96;
            transform: translate3d(0, 100%, 0);
          }
        }

        .fallback-sheet-enter {
          animation: fallbackSheetIn 340ms cubic-bezier(0.32, 0.72, 0, 1) both;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }

        .fallback-sheet-exit {
          animation: fallbackSheetOut 250ms cubic-bezier(0.32, 0.72, 0, 1) both;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }

        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: #e2e8f0 transparent;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 5px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #e2e8f0;
          border-radius: 9999px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
