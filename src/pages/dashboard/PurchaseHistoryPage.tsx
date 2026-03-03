import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { apiFetch } from "../../lib/api";
import { Badge, Button, Card, DropdownSelect, Icon } from "../../components/ui";

const PAGE_SIZE = 10;

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

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

async function apiJson(path: string, init?: RequestInit) {
  return apiFetch(path, init ?? { method: "GET" });
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
  return d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function serviceIconUrl(code: string) {
  const x = String(code ?? "")
    .trim()
    .toLowerCase();
  return `https://cdn.hero-sms.com/assets/img/service/${encodeURIComponent(x)}0.webp`;
}

function countryIconUrl(id: number) {
  return `https://cdn.hero-sms.com/assets/img/country/${encodeURIComponent(String(id))}.svg`;
}

function statusTone(status: string): "emerald" | "amber" | "rose" | "slate" {
  const s = String(status ?? "").toUpperCase();
  if (s === "STATUS_OK" || s === "STATUS_COMPLETED") return "emerald";
  if (s.includes("WAIT")) return "amber";
  if (s.includes("CANCEL") || s.includes("TIMEOUT")) return "rose";
  return "slate";
}

function statusLabel(status: string): string {
  const s = String(status ?? "").toUpperCase();
  if (s === "STATUS_OK" || s === "STATUS_COMPLETED") return "Completed";
  if (s.includes("WAIT_CODE")) return "Waiting SMS";
  if (s.includes("WAIT")) return "Waiting";
  if (s.includes("CANCEL")) return "Cancelled";
  if (s.includes("TIMEOUT")) return "Timeout";
  return status;
}

function statusMatch(status: string, filter: string) {
  const s = String(status ?? "").toUpperCase();
  if (filter === "ALL") return true;
  if (filter === "WAITING") return s.includes("WAIT");
  if (filter === "SUCCESS") return s === "STATUS_OK" || s === "STATUS_COMPLETED";
  if (filter === "CANCELED") return s.includes("CANCEL") || s.includes("TIMEOUT");
  return s === filter;
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

export default function PurchaseHistoryPage() {
  const [items, setItems] = useState<NumberOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [tablePageLoading, setTablePageLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data: any = await apiJson("/api/numbers");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat history",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!statusMatch(item.status, statusFilter)) return false;
      if (!q) return true;
      return (
        String(item.activationId ?? "").toLowerCase().includes(q) ||
        String(item.phoneNumber ?? "").toLowerCase().includes(q) ||
        String(item.serviceName ?? item.service ?? "").toLowerCase().includes(q) ||
        String(item.countryName ?? item.country ?? "").toLowerCase().includes(q) ||
        String(item.smsCode ?? item.smsText ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE)),
    [filteredItems.length]
  );
  const tableLoading = loading || tablePageLoading;

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const stats = useMemo(() => {
    const total = items.length;
    const success = items.filter(
      (i) => i.status.toUpperCase() === "STATUS_OK" || i.status.toUpperCase() === "STATUS_COMPLETED"
    ).length;
    const waiting = items.filter((i) => i.status.toUpperCase().includes("WAIT")).length;
    const canceled = items.filter(
      (i) => i.status.toUpperCase().includes("CANCEL") || i.status.toUpperCase().includes("TIMEOUT")
    ).length;
    const totalSpent = items.reduce((sum, i) => sum + (Number(i.pricePaid) || 0), 0);
    return { total, success, waiting, canceled, totalSpent };
  }, [items]);

  const copyText = useCallback(async (text: string) => {
    const t = String(text ?? "").trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      sileo.success({
        title: "Disalin",
        description: t,
        position: "top-center",
      });
    } catch {
      sileo.error({
        title: "Gagal copy",
        description: "Browser menolak akses clipboard.",
        position: "top-center",
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!tablePageLoading) return;
    const timer = window.setTimeout(() => setTablePageLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [tablePageLoading]);

  const goToPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, nextPage));
      if (clamped === page) return;
      setTablePageLoading(true);
      setPage(clamped);
    },
    [page, totalPages]
  );

  const statusDotColor: Record<string, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    slate: "bg-slate-400",
  };

  const statusBgColor: Record<string, string> = {
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/70",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/70",
    rose:
      "bg-rose-50 text-rose-700 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/70",
    slate:
      "bg-slate-50 text-slate-600 ring-slate-200/60 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-slate-700/70",
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Order",
            value: stats.total,
            icon: "solar:bag-4-bold-duotone",
            color: "from-blue-500 to-indigo-600",
            bgLight: "bg-blue-50",
            textColor: "text-blue-600",
          },
          {
            label: "Berhasil",
            value: stats.success,
            icon: "solar:check-circle-bold-duotone",
            color: "from-emerald-500 to-green-600",
            bgLight: "bg-emerald-50",
            textColor: "text-emerald-600",
          },
          {
            label: "Menunggu",
            value: stats.waiting,
            icon: "solar:clock-circle-bold-duotone",
            color: "from-amber-500 to-orange-600",
            bgLight: "bg-amber-50",
            textColor: "text-amber-600",
          },
          {
            label: "Total Belanja",
            value: formatMoney(stats.totalSpent),
            icon: "solar:wallet-money-bold-duotone",
            color: "from-violet-500 to-purple-600",
            bgLight: "bg-violet-50",
            textColor: "text-violet-600",
            isString: true,
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="!p-0 overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700/80 dark:shadow-black/20"
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
                  <p
                    className={cx(
                      "font-bold",
                      stat.isString ? "text-lg" : "text-2xl",
                      "text-slate-800"
                    )}
                  >
                    {loading ? (
                      <span className="inline-block h-6 w-16 animate-pulse rounded-lg bg-slate-100" />
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

      {/* Main Table Card */}
      <Card className="!p-0 overflow-hidden shadow-sm dark:border-slate-700/80 dark:shadow-black/20">
        {/* Header */}
        <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4 dark:border-slate-700/70 dark:from-slate-900/85 dark:to-slate-900/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/20">
                <Icon name="iconify:solar:history-bold" className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Riwayat Pembelian</h2>
                <p className="text-[11px] text-slate-400">
                  {loading
                    ? "Memuat data..."
                    : `${filteredItems.length} transaksi ditemukan`}
                </p>
              </div>
            </div>
           
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="border-b border-slate-100/80 px-5 py-3 dark:border-slate-700/70">
          <div className="grid gap-2.5 sm:grid-cols-[1fr_200px]">
            <div className="relative group">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                <Icon name="search" className="h-4 w-4 mb-[3px]" />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nomor, layanan, negara, kode SMS..."
                className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-emerald-600/20"
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
            <DropdownSelect
              className="cursor-pointer"
              value={statusFilter}
              onChange={setStatusFilter}
              leftIcon="iconify:solar:filter-bold-duotone"
              options={[
                { value: "ALL", label: "Semua Status" },
                { value: "WAITING", label: "Waiting" },
                { value: "SUCCESS", label: "Sukses" },
                { value: "CANCELED", label: "Cancel/Timeout" },
              ]}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100/80 bg-slate-50/40 dark:border-slate-700/80 dark:bg-slate-900/40">
                {["Waktu", "Layanan", "Negara", "Nomor", "Harga", "Status", "SMS Code"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400/80 dark:text-slate-500"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/80">
              {tableLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div
                          className={cx(
                            "rounded-lg bg-slate-100/80 dark:bg-slate-800/80",
                            j === 5 ? "h-6 w-20 rounded-full" : "h-3.5",
                            j === 4 ? "w-16" : j === 6 ? "w-14" : "w-24"
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                        <Icon
                          name="iconify:solar:inbox-line-bold-duotone"
                          className="h-7 w-7 text-slate-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-500">Tidak ada data</p>
                        <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                          Belum ada riwayat pembelian yang cocok dengan filter yang dipilih
                        </p>
                      </div>
                      {(query || statusFilter !== "ALL") && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setQuery("");
                            setStatusFilter("ALL");
                          }}
                          className="!h-8 mt-1 gap-2.5 !text-[11px]"
                        >
                          <Icon name="iconify:solar:close-circle-bold" className="h-3.5 w-3.5 gap-4 mb-[2px]" />
                          <span> Reset Filter</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedItems.map((item, idx) => {
                  const tone = statusTone(item.status);
                  return (
                    <tr
                      key={item.id}
                      className="group align-top transition-all duration-200 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/15"
                    >
                      {/* Waktu */}
                      <td className="px-5 py-4">
                        <div className="text-xs font-medium text-slate-700">
                          {formatTime(item.createdAt)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {relativeTime(item.createdAt)}
                        </div>
                        <button
                          onClick={() => copyText(item.activationId)}
                          className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-600 dark:bg-slate-800/80 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                          title="Copy Activation ID"
                        >
                          <Icon name="iconify:solar:copy-linear" className="h-2.5 w-2.5" />
                          {item.activationId}
                        </button>
                      </td>

                      {/* Layanan */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                            <img
                              src={serviceIconUrl(item.service)}
                              alt=""
                              className="h-5 w-5 rounded object-contain"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                          <span className="font-bold text-xs text-slate-800">
                            {String(item.serviceName ?? item.service).toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* Negara */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2">
                          <img
                            src={countryIconUrl(item.country)}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover ring-1 ring-slate-100 shadow-sm dark:ring-slate-700"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <span className="text-xs text-slate-600">
                            {item.countryName || `Country ${item.country}`}
                          </span>
                        </div>
                      </td>

                      {/* Nomor */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => copyText(item.phoneNumber)}
                          className="group/num inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-700 transition-all hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                          title="Copy nomor"
                        >
                          {item.phoneNumber}
                          <Icon
                            name="iconify:solar:copy-linear"
                            className="h-3 w-3 opacity-0 transition-opacity group-hover/num:opacity-100"
                          />
                        </button>
                      </td>

                      {/* Harga */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50/80 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300">
                          {formatMoney(item.pricePaid)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={cx(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1",
                            statusBgColor[tone]
                          )}
                        >
                          <span
                            className={cx(
                              "h-1.5 w-1.5 rounded-full",
                              statusDotColor[tone],
                              tone === "amber" && "animate-pulse"
                            )}
                          />
                          {statusLabel(item.status)}
                        </span>
                      </td>

                      {/* SMS Code */}
                      <td className="px-5 py-4">
                        {item.smsCode || item.smsText ? (
                          <button
                            onClick={() => copyText(item.smsCode || item.smsText || "")}
                            className="group/sms inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 transition-all hover:bg-emerald-100 hover:shadow-sm dark:bg-emerald-950/35 dark:hover:bg-emerald-950/60"
                            title="Copy SMS Code"
                          >
                            <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                              {item.smsCode || item.smsText}
                            </span>
                            <Icon
                              name="iconify:solar:copy-bold"
                              className="h-3.5 w-3.5 text-emerald-400 transition-transform group-hover/sms:scale-110 dark:text-emerald-400/80"
                            />
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-300 dark:text-slate-500">
                            <Icon
                              name="iconify:solar:minus-circle-linear"
                              className="h-3.5 w-3.5"
                            />
                            Belum ada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredItems.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100/80 bg-slate-50/30 px-5 py-3.5 dark:border-slate-700/80 dark:bg-slate-900/35 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-400">
              Menampilkan{" "}
              <span className="font-bold text-slate-600">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredItems.length)}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-slate-600">{filteredItems.length}</span> data
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={tableLoading || page <= 1}
                onClick={() => goToPage(page - 1)}
                className="!h-8 !text-[11px] !font-semibold gap-1"
              >
                <Icon name="iconify:solar:arrow-left-linear" className="h-3 w-3" />
                Prev
              </Button>

              <Button
                variant="secondary"
                size="sm"
                disabled={tableLoading || page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="!h-8 !text-[11px] !font-semibold gap-1"
              >
                Next
                <Icon name="iconify:solar:arrow-right-linear" className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
