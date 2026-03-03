import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { adminFetch } from "../../lib/adminApi";
import { sileo } from "sileo";
import { Button, Card, Icon, useModalPresence } from "../../components/ui";

// ─── Types ───
type Service = { code: string; name: string };

type Country = {
  id: number;
  eng: string;
  rus: string;
  chn: string;
  visible: number;
};

type AdminServiceCountryCustomPrice = {
  id: string;
  service: string;
  country: number;
  customPrice: number;
  isActive: boolean;
  updatedAt: string;
};

type Offer = {
  country: number;
  retail_price: number;
  retail_price_default?: number;
  count?: number;
};

// ─── Helpers ───
function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

async function apiJson(path: string, init?: RequestInit) {
  const res: any = await adminFetch(path, init ?? { method: "GET" });
  if (res && typeof res.json === "function") {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  }
  const data = res ?? {};
  if (data?.ok === false) throw new Error(data?.message || "Request failed");
  return data;
}

function formatIdr(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(x);
}

function parseIdNumber(input: string): number {
  const normalized = input
    .trim()
    .replace(/\s+/g, "")
    .replaceAll(".", "")
    .replaceAll(",", "");
  return Number(normalized);
}

function minDelay<T>(promise: Promise<T>, ms = 600): Promise<T> {
  return Promise.all([
    promise,
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]).then(([result]) => result);
}

// ─── Skeleton ───
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-md bg-slate-100", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-50">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </td>
      <td className="px-5 py-3.5">
        <Skeleton className="h-6 w-16 rounded-full" />
      </td>
      <td className="px-5 py-3.5">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

function TableSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </>
  );
}

function BootSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="!p-0 overflow-hidden border-0 shadow-sm">
            <div className="relative p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="!p-0 overflow-hidden border-0 shadow-sm">
        <div className="border-b border-slate-100/80 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-44 rounded-xl" />
              <Skeleton className="h-10 w-48 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100/80 bg-slate-50/40">
              {["Negara", "Harga Default", "Harga Custom", "Status", "Aksi"].map((h) => (
                <th key={h} className="px-5 py-3 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableSkeleton count={10} />
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Icon Components ───
function ServiceIcon({ code, name }: { code: string; name: string }) {
  const src = `https://cdn.hero-sms.com/assets/img/service/${code}0.webp`;
  return (
    <div className="flex h-5 w-5 items-center justify-center">
      <img
        src={src}
        alt={name}
        className="h-5 w-5"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}

function CountryIcon({ id, name }: { id: number; name: string }) {
  const src = `https://cdn.hero-sms.com/assets/img/country/${id}.svg`;
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white">
      <img
        src={src}
        alt={name}
        className="h-6 w-6"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}

// ─── Service Dropdown ───
function ServiceDropdown({
  services,
  value,
  onChange,
}: {
  services: Service[];
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => services.find((s) => s.code === value) ?? null,
    [services, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [services, search]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setSearch("");
        }}
        className={cx(
          "flex items-center gap-2 w-full rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200/80 transition-all duration-200",
          "hover:ring-slate-300",
          open && "ring-2 ring-emerald-500/40"
        )}
      >
        {selected ? (
          <div className="flex items-center gap-2 flex-1">
            <ServiceIcon code={selected.code} name={selected.name} />
            <span className="text-sm font-semibold text-slate-900 truncate">
              {selected.name}
            </span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-slate-400">Pilih layanan</span>
        )}
        <Icon
          name="iconify:solar:alt-arrow-down-bold"
          className={cx("h-4 w-4 text-slate-400 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <div
        className={cx(
          "absolute z-20 mt-2 w-[340px] rounded-2xl border border-slate-200/80 bg-white shadow-xl transition-all duration-200 origin-top",
          open ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
        )}
      >
        <div className="p-2 border-b border-slate-100">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/50">
            <Icon name="search" className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari layanan…"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              autoFocus={open}
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-slate-400">Tidak ditemukan</div>
          )}
          {filtered.map((s) => {
            const active = s.code === value;
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  onChange(s.code);
                  setOpen(false);
                  setSearch("");
                }}
                className={cx(
                  "w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 flex items-center gap-3",
                  active ? "bg-emerald-50 ring-1 ring-emerald-200/60" : "hover:bg-slate-50"
                )}
              >
                <ServiceIcon code={s.code} name={s.name} />
                <span className="truncate text-sm font-semibold text-slate-900 flex-1">{s.name}</span>
                {active && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Modal ───
function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { mounted, isClosing } = useModalPresence(open);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open, onClose]);

  if (!mounted) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={cx("fixed inset-0 z-[1000]", isClosing && "pointer-events-none")}>
      <button
        type="button"
        className={cx(
          "absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] dark:bg-black/70",
          isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
        )}
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cx(
            "ui-modal-surface w-[92vw] max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40",
            isClosing ? "modal-panel-exit" : "modal-panel-enter"
          )}
        >
          <div className="ui-modal-header flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <Icon name="iconify:solar:close-circle-bold" className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 dark:text-slate-200">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Status Badge ───
function StatusBadge({ isCustom }: { isCustom: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 transition-all duration-200",
        isCustom
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
          : "bg-slate-50 text-slate-500 ring-slate-200/70"
      )}
    >
      {isCustom ? (
        <Icon name="iconify:solar:star-bold-duotone" className="h-3 w-3" />
      ) : (
        <Icon name="iconify:solar:shield-check-bold-duotone" className="h-3 w-3" />
      )}
      {isCustom ? "CUSTOM" : "DEFAULT"}
    </span>
  );
}

// ─── Main Component ───
export default function ServiceCountryCustomPrice() {
  const [services, setServices] = useState<Service[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");

  const [customItems, setCustomItems] = useState<AdminServiceCountryCustomPrice[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  const [query, setQuery] = useState("");
  const [booting, setBooting] = useState(true);
  const [loadingList, setLoadingList] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editCountryId, setEditCountryId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editDefaultPrice, setEditDefaultPrice] = useState<number>(0);
  const [editHasOffer, setEditHasOffer] = useState<boolean>(false);

  const selectedServiceObj = useMemo(
    () => services.find((s) => s.code === selectedService) ?? null,
    [services, selectedService]
  );

  const countriesVisible = useMemo(() => countries.filter((c) => c.visible === 1), [countries]);

  const customMap = useMemo(() => {
    const m = new Map<number, AdminServiceCountryCustomPrice>();
    customItems.forEach((r) => m.set(r.country, r));
    return m;
  }, [customItems]);

  const offerMap = useMemo(() => {
    const m = new Map<number, Offer>();
    offers.forEach((o) => m.set(o.country, o));
    return m;
  }, [offers]);

  const filteredCountries = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return countriesVisible;
    return countriesVisible.filter((c) => {
      const eng = (c.eng ?? "").toLowerCase();
      const rus = (c.rus ?? "").toLowerCase();
      const chn = (c.chn ?? "").toLowerCase();
      return eng.includes(t) || rus.includes(t) || chn.includes(t) || String(c.id).includes(t);
    });
  }, [countriesVisible, query]);

  const rows = useMemo(() => {
    return filteredCountries
      .filter((c) => offerMap.has(c.id))
      .map((c) => {
        const custom = customMap.get(c.id);
        const offer = offerMap.get(c.id);
        const defaultPrice = Number(offer?.retail_price_default ?? offer?.retail_price ?? 0);
        const customPrice = Number(custom?.customPrice ?? NaN);
        const hasCustom = Boolean(custom && custom.isActive);
        return { c, offer, custom, defaultPrice, customPrice, hasCustom };
      });
  }, [filteredCountries, customMap, offerMap]);

  const countryName = (c: Country) => c.eng || c.rus || c.chn || `#${c.id}`;

  const customCount = useMemo(() => rows.filter((r) => r.hasCustom).length, [rows]);

  // ─── Boot ───
  async function boot() {
    try {
      setBooting(true);
      const [sRes, cRes] = await minDelay(
        Promise.all([apiJson("/api/herosms/services"), apiJson("/api/herosms/countries")]),
        800
      );
      const svcs = Array.isArray(sRes?.services) ? sRes.services : [];
      const ctys = Array.isArray(cRes?.countries) ? cRes.countries : [];
      setServices(svcs);
      setCountries(ctys);
      setSelectedService((prev) => prev || svcs[0]?.code || "");
      sileo.success({
        title: "Success",
        description: "Data layanan & negara siap",
        position: "top-center",
      });
    } catch (e: any) {
      sileo.error({
        title: "Error",
        description: e?.message || "Gagal memuat data awal",
        position: "top-center",
      });
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    boot();
  }, []);

  // ─── Load service data ───
  const loadAllForService = useCallback(
    async (serviceCode: string) => {
      if (!serviceCode) return;
      try {
        setLoadingList(true);
        const [customRes, offerRes] = await minDelay(
          Promise.all([
            apiJson(`/admin/services/custom-prices?service=${encodeURIComponent(serviceCode)}`),
            apiJson(`/api/herosms/top-countries?service=${encodeURIComponent(serviceCode)}&freePrice=1`),
          ]),
          500
        );
        setCustomItems(Array.isArray(customRes?.items) ? customRes.items : []);
        setOffers(Array.isArray(offerRes?.offers) ? offerRes.offers : []);

        const svcName =
          selectedServiceObj?.name ??
          services.find((s) => s.code === serviceCode)?.name ??
          serviceCode.toUpperCase();

        sileo.info({
          title: "Data Dimuat",
          description: `Memuat data: ${svcName}`,
          position: "top-center",
        });
      } catch (e: any) {
        setCustomItems([]);
        setOffers([]);
        sileo.error({
          title: "Error",
          description: e?.message || "Gagal memuat data service",
          position: "top-center",
        });
      } finally {
        setLoadingList(false);
      }
    },
    [selectedServiceObj, services]
  );

  useEffect(() => {
    if (!selectedService || booting) return;
    loadAllForService(selectedService);
  }, [selectedService, booting, loadAllForService]);

  // ─── Edit Modal ───
  function openEdit(countryId: number, defaultPrice: number) {
    const custom = customMap.get(countryId);
    setEditCountryId(countryId);
    setEditPrice(custom ? String(custom.customPrice) : "");
    setEditDefaultPrice(defaultPrice);
    setEditHasOffer(defaultPrice > 0);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditCountryId(null);
    setEditPrice("");
    setSaving(false);
    setResetting(false);
  }

  async function saveCustom() {
    if (!selectedService || !editCountryId) return;
    const customPrice = parseIdNumber(editPrice);
    if (!Number.isFinite(customPrice) || customPrice <= 0) {
      sileo.warning({
        title: "Warning",
        description: "Custom price harus angka > 0",
        position: "top-center",
      });
      return;
    }
    try {
      setSaving(true);
      const res = await minDelay(
        apiJson("/admin/services/custom-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service: selectedService,
            country: editCountryId,
            customPrice,
            isActive: true,
          }),
        }),
        500
      );
      const item: AdminServiceCountryCustomPrice | undefined = res?.item;
      if (!item?.id) throw new Error("Response invalid");
      setCustomItems((prev) => {
        const idx = prev.findIndex((x) => x.service === item.service && x.country === item.country);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = item;
          return copy;
        }
        return [item, ...prev];
      });
      sileo.success({
        title: "Success",
        description: "Custom price tersimpan",
        position: "top-center",
      });
      closeEdit();
    } catch (e: any) {
      sileo.error({
        title: "Error",
        description: e?.message || "Gagal simpan custom price",
        position: "top-center",
      });
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault() {
    if (!selectedService || !editCountryId) return;
    const row = customMap.get(editCountryId);
    if (!row?.id) {
      sileo.info({
        title: "Info",
        description: "Tidak ada custom price untuk di-reset",
        position: "top-center",
      });
      return;
    }
    try {
      setResetting(true);
      await minDelay(
        apiJson(`/admin/services/custom-prices/${row.id}`, { method: "DELETE" }),
        500
      );
      setCustomItems((prev) => prev.filter((x) => x.id !== row.id));
      sileo.success({
        title: "Success",
        description: "Harga dikembalikan ke default",
        position: "top-center",
      });
      closeEdit();
    } catch (e: any) {
      sileo.error({
        title: "Error",
        description: e?.message || "Gagal reset ke default",
        position: "top-center",
      });
    } finally {
      setResetting(false);
    }
  }

  const editCountry = useMemo(
    () => (editCountryId ? countries.find((c) => c.id === editCountryId) ?? null : null),
    [editCountryId, countries]
  );

  const editCurrentCustom = useMemo(() => {
    if (!editCountryId) return null;
    const row = customMap.get(editCountryId);
    return row?.customPrice ?? null;
  }, [editCountryId, customMap]);

  if (booting) return <BootSkeleton />;

  return (
    <>
      <div className="space-y-6">
        {/* ════════ STATS CARDS ════════ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            {
              label: "Total Negara",
              value: String(rows.length),
              icon: "solar:earth-bold-duotone",
              bgLight: "bg-blue-50",
              textColor: "text-blue-600",
              color: "from-blue-500 to-indigo-600",
            },
            {
              label: "Custom Price",
              value: String(customCount),
              icon: "solar:star-bold-duotone",
              bgLight: "bg-emerald-50",
              textColor: "text-emerald-600",
              color: "from-emerald-500 to-green-600",
            },
            {
              label: "Default Price",
              value: String(rows.length - customCount),
              icon: "solar:shield-check-bold-duotone",
              bgLight: "bg-violet-50",
              textColor: "text-violet-600",
              color: "from-violet-500 to-purple-600",
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="!p-0 overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="relative p-4">
                <div
                  className={cx(
                    "absolute top-0 right-0 h-20 w-20 opacity-[0.04] rounded-bl-[40px]",
                    "bg-gradient-to-br",
                    stat.color
                  )}
                />
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      {stat.label}
                    </p>
                    <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                  </div>
                  <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stat.bgLight)}>
                    <Icon name={`iconify:${stat.icon}`} className={cx("h-5 w-5", stat.textColor)} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ════════ MAIN TABLE ════════ */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex gap-3 flex-row justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon name="iconify:solar:dollar-minimalistic-bold-duotone" className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Custom Harga Layanan</h2>
                  <p className="text-[11px] text-slate-400">
                    {loadingList ? "Memuat data..." : `${rows.length} negara tersedia`}
                  </p>
                </div>
              </div>
              {selectedServiceObj && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                  <ServiceIcon code={selectedServiceObj.code} name={selectedServiceObj.name} />
                  <span className="text-xs font-bold text-slate-700">{selectedServiceObj.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="border-b border-slate-100/80 px-5 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <ServiceDropdown services={services} value={selectedService} onChange={setSelectedService} />

              <div className="relative group flex-1 max-w-xs">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                  <Icon name="search" className="h-4 w-4" />
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari negara…"
                  className="w-full h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-10 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    <Icon name="iconify:solar:close-circle-bold" className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadAllForService(selectedService)}
                isLoading={loadingList}
                className="!h-10 !w-10 !p-0 shrink-0"
                title="Refresh"
              >
                <Icon name="iconify:solar:refresh-bold-duotone" className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[680px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                <tr className="border-b border-slate-100/80 bg-slate-50/40">
                  {["Negara", "Harga Default", "Harga Custom", "Status", "Aksi"].map((h) => (
                    <th
                      key={h}
                      className={cx(
                        "px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400/80",
                        h === "Aksi" ? "text-right" : "text-left"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingList ? (
                  <TableSkeleton count={8} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                          <Icon name="iconify:solar:earth-bold-duotone" className="h-7 w-7 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-500">Tidak ada data</p>
                          <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                            Coba ubah filter atau pilih layanan lain
                          </p>
                        </div>
                        {query && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setQuery("")}
                            className="!h-8 mt-1 gap-1.5 !text-[11px]"
                          >
                            <Icon name="iconify:solar:close-circle-bold" className="h-3.5 w-3.5" />
                            Reset Pencarian
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map(({ c, defaultPrice, custom, hasCustom }) => {
                    const name = countryName(c);
                    const customPrice = hasCustom ? Number(custom?.customPrice ?? 0) : NaN;

                    return (
                      <tr
                        key={c.id}
                        className={cx(
                          "group align-top transition-all duration-200",
                          hasCustom ? "hover:bg-emerald-50/30" : "hover:bg-blue-50/20"
                        )}
                      >
                        {/* Negara */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <CountryIcon id={c.id} name={name} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{name}</p>
                              <p className="text-[10px] text-slate-400">ID: {c.id}</p>
                            </div>
                          </div>
                        </td>

                        {/* Harga Default */}
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center rounded-lg bg-slate-50/80 px-2 py-1 text-xs font-bold text-slate-700">
                              {defaultPrice ? formatIdr(defaultPrice) : "—"}
                            </span>
                            <p className="text-[10px] text-slate-400">rate + profit</p>
                          </div>
                        </td>

                        {/* Harga Custom */}
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5">
                            {hasCustom ? (
                              <span className="inline-flex items-center rounded-lg bg-emerald-50/80 px-2 py-1 text-xs font-bold text-emerald-700">
                                {formatIdr(customPrice)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                            <p className="text-[10px] text-slate-400">
                              {hasCustom ? "override aktif" : "no override"}
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <StatusBadge isCustom={hasCustom} />
                        </td>

                        {/* Aksi */}
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEdit(c.id, defaultPrice)}
                              className="!h-8 !w-8 !p-0"
                              title="Edit harga"
                            >
                              <Icon name="iconify:solar:pen-bold-duotone" className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100/80 bg-slate-50/30 px-5 py-3">
            <p className="text-[11px] text-slate-400">
              Klik <span className="font-bold text-slate-600">Edit</span> untuk mengubah harga. Gunakan{" "}
              <span className="font-bold text-slate-600">Reset Default</span> di modal untuk menghapus override.
            </p>
          </div>
        </Card>
      </div>

      {/* ════════ EDIT MODAL ════════ */}
      <Modal
        open={editOpen}
        onClose={closeEdit}
        title={
          <div className="flex items-center gap-3">
            {selectedServiceObj && (
              <ServiceIcon code={selectedServiceObj.code} name={selectedServiceObj.name} />
            )}
            <div className="min-w-0">
              <div className="truncate">
                Edit Harga • {selectedServiceObj?.name ?? selectedService}
              </div>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Default price card */}
          <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <Icon name="iconify:solar:shield-check-bold-duotone" className="h-3.5 w-3.5" />
                  Harga Default
                </div>
                <div className="mt-1.5 text-xl font-extrabold text-slate-900">
                  {editDefaultPrice ? formatIdr(editDefaultPrice) : "—"}
                </div>
                <div className="mt-1 text-xs text-slate-500">Hasil (USD × rate) + profit%</div>
              </div>
              {editCountry && <CountryIcon id={editCountry.id} name={countryName(editCountry)} />}
            </div>
          </div>

          {/* Custom price input */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Icon name="iconify:solar:star-bold-duotone" className="h-3.5 w-3.5 text-emerald-500" />
              Harga Custom
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder={editCurrentCustom != null ? String(editCurrentCustom) : "contoh: 25000"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400"
                />
              </div>
              <div className="shrink-0 text-right text-xs font-bold text-emerald-600">
                {Number.isFinite(parseIdNumber(editPrice)) && parseIdNumber(editPrice) > 0
                  ? formatIdr(parseIdNumber(editPrice))
                  : ""}
              </div>
            </div>

            {editCurrentCustom != null && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <Icon name="iconify:solar:info-circle-bold-duotone" className="h-3 w-3" />
                Saat ini: {formatIdr(editCurrentCustom)}
              </div>
            )}

            <div className="mt-2 text-xs text-slate-400">
              Kosongkan tidak otomatis reset. Gunakan tombol{" "}
              <b className="text-slate-600">Reset Default</b> untuk menghapus override.
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={closeEdit} className="!text-xs">
              Batal
            </Button>

            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={resetToDefault}
                disabled={resetting || saving || editCurrentCustom == null}
                isLoading={resetting}
                className="!text-xs gap-1.5"
              >
                <Icon name="iconify:solar:restart-bold-duotone" className="h-3.5 w-3.5" />
                {resetting ? "Mereset…" : "Reset Default"}
              </Button>

              <Button
                size="sm"
                onClick={saveCustom}
                disabled={saving || resetting}
                isLoading={saving}
                className="!text-xs gap-1.5"
              >
                <Icon name="iconify:solar:diskette-bold-duotone" className="h-3.5 w-3.5" />
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}
