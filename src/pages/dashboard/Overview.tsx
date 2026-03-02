import { useCallback, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { sileo } from "sileo";
import { API_BASE, apiFetch } from "../../lib/api";
import { Badge, Button, Card, Icon } from "../../components/ui";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";

type NumberOrder = {
  id: string;
  activationId: string;
  phoneNumber: string;
  service: string;
  serviceName?: string | null;
  country: number;
  countryName?: string | null;
  pricePaid: number;
  status: string;
  smsCode?: string | null;
  smsText?: string | null;
  createdAt: string;
  updatedAt: string;
};

type DayStat = {
  key: string;
  label: string;
  total: number;
  success: number;
  error: number;
};

type NewsInfo = {
  id: string;
  title: string;
  summary: string;
  content: string;
  tag?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type WebsiteSettingsData = {
  siteName: string;
  siteDescription: string;
  logoUrl?: string | null;
  maintenanceMode: boolean;
  maintenanceMessage?: string | null;
};

type WebsiteBanner = {
  id: string;
  imageUrl: string;
  title?: string | null;
  subtitle?: string | null;
  linkUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
};

const DAY_OPTIONS = [7, 14, 30];

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

async function apiJson(path: string, init?: RequestInit) {
  return apiFetch(path, init ?? { method: "GET" });
}

function normalizeStatus(status: string) {
  return String(status ?? "").toUpperCase();
}

function isSuccessStatus(status: string) {
  const s = normalizeStatus(status);
  return s === "STATUS_OK" || s === "STATUS_COMPLETED";
}

function isErrorStatus(status: string) {
  const s = normalizeStatus(status);
  return (
    s.includes("CANCEL") ||
    s.includes("TIMEOUT") ||
    s.includes("FAILED") ||
    s.includes("ERROR")
  );
}

function isWaitingStatus(status: string) {
  return normalizeStatus(status).includes("WAIT");
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

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return "";
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function stripHtml(value: string) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveMediaUrl(url?: string | null) {
  const value = String(url ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return `${API_BASE}${value.startsWith("/") ? "" : "/"}${value}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl shadow-slate-900/10">
      <p className="text-[11px] font-bold text-slate-700">{label}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-bold text-slate-800">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Overview() {
  const [items, setItems] = useState<NumberOrder[]>([]);
  const [newsItems, setNewsItems] = useState<NewsInfo[]>([]);
  const [websiteSettings, setWebsiteSettings] = useState<WebsiteSettingsData | null>(null);
  const [websiteBanners, setWebsiteBanners] = useState<WebsiteBanner[]>([]);
  const [expandedNewsIds, setExpandedNewsIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(14);

  const toggleNewsExpand = useCallback((id: string) => {
    setExpandedNewsIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [numbersData, newsData, websiteData] = await Promise.all([
        apiJson("/api/numbers"),
        apiJson("/api/news?limit=3"),
        apiJson("/api/website"),
      ]);
      setItems(Array.isArray(numbersData?.items) ? numbersData.items : []);
      setNewsItems(Array.isArray(newsData?.items) ? newsData.items : []);
      setWebsiteSettings(websiteData?.settings ?? null);
      setWebsiteBanners(Array.isArray(websiteData?.banners) ? websiteData.banners : []);
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat overview",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalOrders = items.length;
  const totalSuccess = useMemo(
    () => items.filter((x) => isSuccessStatus(x.status)).length,
    [items]
  );
  const totalError = useMemo(
    () => items.filter((x) => isErrorStatus(x.status)).length,
    [items]
  );
  const totalWaiting = useMemo(
    () => items.filter((x) => isWaitingStatus(x.status)).length,
    [items]
  );

  const todayCount = useMemo(() => {
    const now = new Date();
    return items.filter((x) => {
      const d = new Date(x.createdAt);
      if (Number.isNaN(d.getTime())) return false;
      return sameDay(d, now);
    }).length;
  }, [items]);

  const totalSpent = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.pricePaid || 0), 0),
    [items]
  );

  const successRate = useMemo(
    () => (totalOrders > 0 ? Math.round((totalSuccess / totalOrders) * 100) : 0),
    [totalOrders, totalSuccess]
  );

  const chartData = useMemo<DayStat[]>(() => {
    const now = new Date();
    const base: DayStat[] = [];
    const byKey = new Map<string, DayStat>();

    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const row: DayStat = {
        key,
        label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        total: 0,
        success: 0,
        error: 0,
      };
      base.push(row);
      byKey.set(key, row);
    }

    for (const item of items) {
      const d = new Date(item.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const row = byKey.get(dayKey(d));
      if (!row) continue;
      row.total += 1;
      if (isSuccessStatus(item.status)) row.success += 1;
      if (isErrorStatus(item.status)) row.error += 1;
    }

    return base;
  }, [days, items]);

  const latestNews = useMemo(
    () =>
      newsItems
        .slice()
        .sort(
          (a, b) =>
            new Date(b.publishedAt ?? b.createdAt).getTime() -
            new Date(a.publishedAt ?? a.createdAt).getTime()
        )
        .slice(0, 3),
    [newsItems]
  );

  const sliderBanners = useMemo(() => {
    if (websiteBanners.length === 2)
      return [websiteBanners[0], websiteBanners[1], websiteBanners[0]];
    return websiteBanners;
  }, [websiteBanners]);
  const canLoopBanners = sliderBanners.length > 1;
  const initialBannerIndex = canLoopBanners ? 1 : 0;

  return (
    <div className="space-y-6">
      {/* ════════ MAINTENANCE BANNER ════════ */}
      {websiteSettings?.maintenanceMode && (
        <div className="rounded-xl border border-red-200/60 bg-gradient-to-r from-red-50/80 to-red-50/50 px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-red-500 shadow-lg shadow-red-500/25">
              <Icon
                name="iconify:solar:danger-triangle-bold-duotone"
                className="h-4.5 w-4.5 text-white"
              />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Maintenance Sedang Aktif</p>
              <p className="mt-0.5 text-xs text-red-700/80 leading-relaxed">
                {websiteSettings.maintenanceMessage ||
                  "Beberapa layanan mungkin tidak stabil untuk sementara waktu."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ════════ BANNER SLIDER ════════ */}
      {sliderBanners.length > 0 && (
        <div className="relative website-banner-shell">
          <Swiper
            modules={[Navigation, Pagination]}
            speed={900}
            loop={false}
            rewind={canLoopBanners}
            centeredSlides={canLoopBanners}
            allowTouchMove={canLoopBanners}
            initialSlide={initialBannerIndex}
            navigation={canLoopBanners}
            pagination={{ clickable: true }}
            onSwiper={(swiper) => {
              if (!canLoopBanners) return;
              window.requestAnimationFrame(() => {
                swiper.slideTo(initialBannerIndex, 0, false);
              });
            }}
            slidesPerView={1.04}
            spaceBetween={12}
            breakpoints={{
              640: { slidesPerView: 1.16, spaceBetween: 14 },
              1024: { slidesPerView: 1.34, spaceBetween: 16 },
              1280: { slidesPerView: 1.48, spaceBetween: 18 },
            }}
            className="website-banner-swiper"
          >
            {sliderBanners.map((banner, idx) => (
              <SwiperSlide key={`${banner.id}-${idx}`} className="website-banner-slide">
                <div className="relative h-[150px] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-sm sm:h-[240px] lg:h-[380px]">
                  <img
                    src={resolveMediaUrl(banner.imageUrl)}
                    alt={banner.title || "Banner"}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
                  <div className="absolute inset-0 flex items-end p-5 sm:p-7">
                    <div className="max-w-xl text-white">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                        {websiteSettings?.siteName || "Website Info"}
                      </p>
                      {banner.title && (
                        <h3 className="mt-1.5 text-lg font-bold leading-tight sm:text-2xl">
                          {banner.title}
                        </h3>
                      )}
                      {banner.subtitle && (
                        <p className="mt-1.5 text-xs leading-relaxed text-white/85 sm:text-sm">
                          {banner.subtitle}
                        </p>
                      )}
                      {banner.linkUrl && (
                        <a
                          href={banner.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 backdrop-blur-sm px-3.5 py-2 text-xs font-bold text-white ring-1 ring-white/20 transition-all hover:bg-white/25 hover:shadow-lg"
                        >
                          Lihat Detail
                          <Icon
                            name="iconify:solar:alt-arrow-right-bold-duotone"
                            className="h-3.5 w-3.5"
                          />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-slate-50/95 via-slate-50/50 to-transparent sm:w-20" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-slate-50/95 via-slate-50/50 to-transparent sm:w-20" />
        </div>
      )}

      {/* ════════ STATS CARDS ════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Pesanan",
            value: loading ? null : String(totalOrders),
            icon: "solar:bill-list-bold-duotone",
            color: "from-blue-500 to-indigo-600",
            bgLight: "bg-blue-50",
            textColor: "text-blue-600",
          },
          {
            label: "Berhasil",
            value: loading ? null : String(totalSuccess),
            icon: "solar:check-circle-bold-duotone",
            color: "from-emerald-500 to-green-600",
            bgLight: "bg-emerald-50",
            textColor: "text-emerald-600",
          },
          {
            label: "Error / Cancel",
            value: loading ? null : String(totalError),
            icon: "solar:danger-triangle-bold-duotone",
            color: "from-rose-500 to-red-600",
            bgLight: "bg-rose-50",
            textColor: "text-rose-600",
          },
          {
            label: "Total Belanja",
            value: loading ? null : formatMoney(totalSpent),
            icon: "solar:wallet-money-bold-duotone",
            color: "from-emerald-500 to-orange-600",
            bgLight: "bg-emerald-50",
            textColor: "text-emerald-600",
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
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {stat.label}
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {loading ? (
                      <span className="inline-block h-6 w-20 animate-pulse rounded-lg bg-slate-100" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
                <div
                  className={cx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    stat.bgLight
                  )}
                >
                  <Icon name={`iconify:${stat.icon}`} className={cx("h-5 w-5", stat.textColor)} />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ════════ CHART + NEWS ════════ */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* ──── Chart ──── */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-violet-500/20">
                  <Icon
                    name="iconify:solar:graph-new-bold-duotone"
                    className="h-4.5 w-4.5 text-white"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Grafik Transaksi</h2>
                  <p className="text-[11px] text-slate-400">
                    Total harian vs sukses vs error
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100/80 p-0.5">
                {DAY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setDays(opt)}
                    className={cx(
                      "rounded-md px-3 py-1.5 text-[11px] font-bold transition-all duration-200",
                      days === opt
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {opt}D
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-200/70 animate-pulse" />
                      <div className="h-3 w-16 rounded-md bg-slate-200/70 animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="h-[320px] rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 emerald-t-violet-500" />
                    <p className="text-[11px] font-medium text-slate-400">Memuat grafik...</p>
                  </div>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                  <Icon
                    name="iconify:solar:graph-new-bold-duotone"
                    className="h-6 w-6 text-slate-300"
                  />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">Belum ada data transaksi</p>
                <p className="mt-1 text-xs text-slate-400 max-w-[200px] leading-relaxed">
                  Data akan muncul setelah ada transaksi masuk
                </p>
              </div>
            ) : (
              <div>
                {/* Legend */}
                <div className="mb-4 flex flex-wrap items-center gap-4 px-1">
                  {[
                    { label: "Total Harian", from: "from-slate-400", to: "to-slate-500" },
                    { label: "Sukses", from: "from-emerald-400", to: "to-emerald-500" },
                    { label: "Error", from: "from-rose-400", to: "to-rose-500" },
                  ].map((legend) => (
                    <div key={legend.label} className="flex items-center gap-2">
                      <span
                        className={cx(
                          "inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br shadow-sm",
                          legend.from,
                          legend.to
                        )}
                      />
                      <span className="text-[11px] font-medium text-slate-500">{legend.label}</span>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 8, right: 16, left: -8, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="areaTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.25} />
                          <stop offset="50%" stopColor="#94a3b8" stopOpacity={0.1} />
                          <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="areaSuccess" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                          <stop offset="50%" stopColor="#34d399" stopOpacity={0.1} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="areaError" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fb7185" stopOpacity={0.25} />
                          <stop offset="50%" stopColor="#fb7185" stopOpacity={0.08} />
                          <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                        </linearGradient>
                        <filter id="glowSuccess" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feFlood floodColor="#34d399" floodOpacity="0.3" />
                          <feComposite in2="blur" operator="in" />
                          <feMerge>
                            <feMergeNode />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <filter id="glowError" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feFlood floodColor="#fb7185" floodOpacity="0.3" />
                          <feComposite in2="blur" operator="in" />
                          <feMerge>
                            <feMergeNode />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      <CartesianGrid strokeDasharray="none" stroke="transparent" vertical={false} horizontal={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        dy={8}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                        dx={-4}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{
                          stroke: "#cbd5e1",
                          strokeWidth: 1,
                          strokeDasharray: "4 4",
                        }}
                      />
                      <Area
                        type="natural"
                        dataKey="total"
                        name="Total Harian"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        fill="url(#areaTotal)"
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: "#fff",
                          stroke: "#94a3b8",
                          strokeWidth: 2.5,
                          className: "drop-shadow-sm",
                        }}
                        animationDuration={1200}
                        animationEasing="ease-in-out"
                      />
                      <Area
                        type="natural"
                        dataKey="success"
                        name="Sukses"
                        stroke="#34d399"
                        strokeWidth={2.5}
                        fill="url(#areaSuccess)"
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: "#fff",
                          stroke: "#34d399",
                          strokeWidth: 2.5,
                          filter: "url(#glowSuccess)",
                        }}
                        animationDuration={1400}
                        animationEasing="ease-in-out"
                      />
                      <Area
                        type="natural"
                        dataKey="error"
                        name="Error"
                        stroke="#fb7185"
                        strokeWidth={2}
                        fill="url(#areaError)"
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: "#fff",
                          stroke: "#fb7185",
                          strokeWidth: 2.5,
                          filter: "url(#glowError)",
                        }}
                        animationDuration={1600}
                        animationEasing="ease-in-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ──── News / Info ──── */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon
                    name="iconify:solar:document-text-bold-duotone"
                    className="h-4.5 w-4.5 text-white"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">News & Info</h2>
                  <p className="text-[11px] text-slate-400">Informasi terbaru dari admin</p>
                </div>
              </div>
              {latestNews.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-emerald-200/60">
                  {latestNews.length} berita
                </span>
              )}
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="h-4 w-16 rounded-full bg-slate-200/70" />
                      <div className="h-3 w-20 rounded-md bg-slate-200/70" />
                    </div>
                    <div className="h-4 w-3/4 rounded-md bg-slate-200/70" />
                    <div className="mt-2 h-3 w-full rounded-md bg-slate-200/70" />
                    <div className="mt-1 h-3 w-2/3 rounded-md bg-slate-200/70" />
                  </div>
                ))}
              </div>
            ) : latestNews.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                  <Icon
                    name="iconify:solar:document-text-bold-duotone"
                    className="h-6 w-6 text-slate-300"
                  />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">Belum ada news/info</p>
                <p className="mt-1 text-xs text-slate-400">Info terbaru akan tampil di sini</p>
              </div>
            ) : (
              <div className="space-y-3">
                {latestNews.map((news) => {
                  const contentHtml = String(news.content ?? "").trim();
                  const contentText = stripHtml(contentHtml);
                  const sanitizedHtml = DOMPurify.sanitize(contentHtml);
                  const isExpanded = expandedNewsIds.has(news.id);
                  const canToggle = contentText.length > 180;

                  return (
                    <article
                      key={news.id}
                      className="group rounded-xl border border-slate-200/60 bg-white overflow-hidden transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
                    >
                      {/* Article header */}
                      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                            <Icon
                              name="iconify:solar:document-text-bold-duotone"
                              className="h-3.5 w-3.5 text-emerald-500"
                            />
                          </div>
                          {news.tag && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200/60">
                              {news.tag}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-medium text-slate-400">
                            {formatTime(news.publishedAt ?? news.createdAt)}
                          </span>
                          {relativeTime(news.publishedAt ?? news.createdAt) && (
                            <p className="text-[9px] text-slate-300">
                              {relativeTime(news.publishedAt ?? news.createdAt)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Article body */}
                      <div className="px-4 pb-4">
                        <h3 className="text-sm font-bold text-slate-800 leading-snug">
                          {news.title}
                        </h3>
                        
                        {contentText && (
                          <div className={cx("mt-3", !isExpanded && canToggle && "relative pb-6")}>
                            <div
                              className={cx(
                                "news-rich-text overflow-hidden rounded-lg border border-slate-100 bg-slate-50/50",
                                !isExpanded && canToggle && "max-h-36"
                              )}
                            >
                              <div
                                className="ql-editor !p-3"
                                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                              />
                            <p className="mt-1 ml-3 mb-1 text-xs leading-relaxed text-slate-500"># {news.summary}</p>
                            </div>
                            {!isExpanded && canToggle && (
                              <div className="pointer-events-none absolute inset-x-0 bottom-6 h-12 bg-gradient-to-t from-white via-white/80 to-transparent" />
                            )}

                          </div>
                        )}

                        {canToggle && (
                          <button
                            type="button"
                            onClick={() => toggleNewsExpand(news.id)}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 transition-colors hover:text-violet-600"
                          >
                            <Icon
                              name={
                                isExpanded
                                  ? "iconify:solar:alt-arrow-up-bold"
                                  : "iconify:solar:alt-arrow-down-bold"
                              }
                              className="h-3 w-3"
                            />
                            {isExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
