import { type ReactNode, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { sileo } from "sileo";
import { adminFetch } from "../../lib/adminApi";
import { Button, Card, Icon } from "../../components/ui";

const PAGE_SIZE = 20;

type OrderRow = {
  id: string;
  activationId: string;
  service: string;
  serviceName?: string | null;
  country: number;
  countryName?: string | null;
  phoneNumber: string;
  pricePaid: number;
  status: string;
  smsCode?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  user: { id: string; email: string; name?: string | null };
};

type OrdersResponse = {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  items: OrderRow[];
};

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
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

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d lalu`;
  return "";
}

function statusTone(status: string): "emerald" | "amber" | "rose" | "slate" {
  const s = String(status ?? "").toUpperCase();
  if (s === "STATUS_OK" || s === "STATUS_COMPLETED") return "emerald";
  if (s.includes("WAIT")) return "amber";
  if (s.includes("CANCEL") || s.includes("TIMEOUT") || s.includes("FAILED") || s.includes("ERROR"))
    return "rose";
  return "slate";
}

function statusLabel(status: string) {
  const s = String(status ?? "").toUpperCase();
  if (s === "STATUS_OK" || s === "STATUS_COMPLETED") return "Sukses";
  if (s.includes("WAIT")) return "Menunggu";
  if (s.includes("CANCEL")) return "Dibatalkan";
  if (s.includes("TIMEOUT")) return "Timeout";
  if (s.includes("FAILED") || s.includes("ERROR")) return "Error";
  return status;
}

function statusIconName(status: string) {
  const s = String(status ?? "").toUpperCase();
  if (s === "STATUS_OK" || s === "STATUS_COMPLETED") return "iconify:solar:check-circle-bold-duotone";
  if (s.includes("WAIT")) return "iconify:solar:clock-circle-bold-duotone";
  return "iconify:solar:close-circle-bold-duotone";
}

function userInitials(name?: string | null, email?: string) {
  const n = String(name ?? "").trim();
  if (n) {
    const parts = n.split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  }
  return String(email ?? "").slice(0, 2).toUpperCase();
}

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
      <td className="px-5 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 !rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-3.5 w-20 mb-1.5" />
        <Skeleton className="h-2.5 w-16" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-7 w-28 !rounded-lg" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-3.5 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-6 w-20 !rounded-full" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-6 w-18 !rounded-full" />
      </td>
    </tr>
  );
}

const STATUS_TABS = [
  { value: "ALL", label: "Semua", icon: "solar:widget-bold-duotone" },
  { value: "WAITING", label: "Waiting", icon: "solar:clock-circle-bold-duotone" },
  { value: "SUCCESS", label: "Success", icon: "solar:check-circle-bold-duotone" },
  { value: "CANCELED", label: "Canceled", icon: "solar:close-circle-bold-duotone" },
];

export default function AdminOrders() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OrderRow[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [tablePageLoading, setTablePageLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      params.set("status", statusFilter);
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());

      const res = await adminFetch(`/admin/monitor/orders?${params.toString()}`, { method: "GET" });
      const data = (await res.json()) as OrdersResponse;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data?.pagination?.totalPages ?? 1)));
      setTotalItems(Number(data?.pagination?.totalItems ?? 0));
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat admin orders",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!tablePageLoading || loading) return;
    const timer = window.setTimeout(() => setTablePageLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [loading, tablePageLoading]);

  const goToPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, nextPage));
      if (clamped === page) return;
      setTablePageLoading(true);
      setPage(clamped);
    },
    [page, totalPages]
  );

  const pageInfo = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalItems);
    return { start, end };
  }, [page, totalItems]);
  const tableLoading = loading || tablePageLoading;

  const stats = useMemo(() => {
    const success = items.filter((i) => statusTone(i.status) === "emerald").length;
    const waiting = items.filter((i) => statusTone(i.status) === "amber").length;
    const failed = items.filter((i) => statusTone(i.status) === "rose").length;
    const totalSpent = items.reduce((s, i) => s + (Number(i.pricePaid) || 0), 0);
    return { success, waiting, failed, totalSpent };
  }, [items]);

  const copyText = useCallback(async (text: string) => {
    const t = String(text ?? "").trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      sileo.success({ title: "Disalin", description: t, position: "top-center" });
    } catch {
      sileo.error({ title: "Gagal copy", description: "Browser menolak akses clipboard.", position: "top-center" });
    }
  }, []);

  return (
    <>
      <div className="space-y-6">
        {/* ════════ STATS CARDS ════════ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total Orders",
              value: loading ? null : String(totalItems),
              icon: "solar:clipboard-list-bold-duotone",
              color: "from-blue-500 to-indigo-600",
              bgLight: "bg-blue-50",
              textColor: "text-blue-600",
            },
            {
              label: "Sukses",
              value: loading ? null : String(stats.success),
              icon: "solar:check-circle-bold-duotone",
              color: "from-emerald-500 to-green-600",
              bgLight: "bg-emerald-50",
              textColor: "text-emerald-600",
            },
            {
              label: "Menunggu",
              value: loading ? null : String(stats.waiting),
              icon: "solar:clock-circle-bold-duotone",
              color: "from-amber-500 to-orange-600",
              bgLight: "bg-amber-50",
              textColor: "text-amber-600",
            },
            {
              label: "Total Spent",
              value: loading ? null : formatMoney(stats.totalSpent),
              icon: "solar:wallet-bold-duotone",
              color: "from-violet-500 to-purple-600",
              bgLight: "bg-violet-50",
              textColor: "text-violet-600",
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
                    <p className="text-lg font-bold text-slate-800">
                      {loading ? (
                        <span className="inline-block h-6 w-20 animate-pulse rounded-lg bg-slate-100" />
                      ) : (
                        stat.value
                      )}
                    </p>
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
                  <Icon name="iconify:solar:clipboard-list-bold-duotone" className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Admin Orders</h2>
                  <p className="text-[11px] text-slate-400">
                    {loading ? "Memuat data..." : `${totalItems} order terdaftar`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="border-b border-slate-100/80 px-5 py-3 space-y-3">
            {/* Search */}
            <div className="relative group max-w-full">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                <Icon name="search" className="h-4 w-4 mb-[3px]" />
              </span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari user, nomor, layanan, activation id..."
                className="w-full h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-10 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <Icon name="iconify:solar:close-circle-bold" className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Status Tabs */}
            <div className="flex gap-1 rounded-xl bg-slate-50/80 p-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cx(
                    "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-bold transition-all duration-200",
                    statusFilter === tab.value
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Icon name={`iconify:${tab.icon}`} className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100/80 bg-slate-50/40">
                  {["Waktu", "User", "Layanan", "Nomor", "Harga", "Status", "Refund"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400/80"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tableLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : !items.length ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                          <Icon name="iconify:solar:clipboard-list-bold-duotone" className="h-7 w-7 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-500">Tidak ada data order</p>
                          <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                            Coba ubah filter atau kata kunci pencarian
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
                  items.map((item) => {
                    const tone = statusTone(item.status);
                    const toneClasses = {
                      emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
                      amber: "bg-amber-50 text-amber-700 ring-amber-200/60",
                      rose: "bg-rose-50 text-rose-700 ring-rose-200/60",
                      slate: "bg-slate-50 text-slate-600 ring-slate-200/60",
                    };

                    return (
                      <tr
                        key={item.id}
                        className="group align-top transition-all duration-200 hover:bg-blue-50/20"
                      >
                        {/* Waktu */}
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                              <Icon name="iconify:solar:calendar-bold-duotone" className="h-3 w-3 text-slate-400" />
                              {formatTime(item.createdAt)}
                            </div>
                            {relativeTime(item.createdAt) && (
                              <p className="text-[9px] text-slate-400 pl-[18px]">{relativeTime(item.createdAt)}</p>
                            )}
                            <button
                              onClick={() => copyText(item.activationId)}
                              className="group/aid inline-flex items-center gap-1 text-[9px] text-slate-400 hover:text-slate-600 transition-colors pl-[18px]"
                            >
                              <span className="font-mono">{item.activationId}</span>
                              <Icon
                                name="iconify:solar:copy-linear"
                                className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/aid:opacity-100"
                              />
                            </button>
                          </div>
                        </td>

                        {/* User */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white shadow-sm">
                              {userInitials(item.user.name, item.user.email)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {item.user.name || "Unnamed"}
                              </p>
                              <button
                                onClick={() => copyText(item.user.email)}
                                className="group/email inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                              >
                                {item.user.email}
                                <Icon
                                  name="iconify:solar:copy-linear"
                                  className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/email:opacity-100"
                                />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Layanan */}
                        <td className="px-5 py-4">
                          <p className="text-xs font-bold text-slate-800">
                            {String(item.serviceName ?? item.service).toUpperCase()}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                            <Icon name="iconify:solar:map-point-bold-duotone" className="h-3 w-3" />
                            {item.countryName || `Country ${item.country}`}
                          </div>
                        </td>

                        {/* Nomor */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => copyText(item.phoneNumber)}
                            className="group/phone inline-flex items-center gap-1.5 rounded-lg bg-slate-50/80 px-2.5 py-1.5 font-mono text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
                          >
                            <Icon name="iconify:solar:phone-bold-duotone" className="h-3.5 w-3.5 text-slate-400" />
                            {item.phoneNumber}
                            <Icon
                              name="iconify:solar:copy-linear"
                              className="h-2.5 w-2.5 text-slate-300 opacity-0 transition-opacity group-hover/phone:opacity-100"
                            />
                          </button>
                        </td>

                        {/* Harga */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-lg bg-emerald-50/80 px-2 py-1 text-xs font-bold text-emerald-700">
                            {formatMoney(item.pricePaid)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={cx(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1",
                              toneClasses[tone]
                            )}
                          >
                            <Icon name={statusIconName(item.status)} className="h-3 w-3" />
                            {statusLabel(item.status)}
                          </span>
                        </td>

                        {/* Refund */}
                        <td className="px-5 py-4">
                          {item.refundedAt ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                              <Icon name="iconify:solar:check-circle-bold-duotone" className="h-3 w-3" />
                              Refunded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-400 ring-1 ring-slate-200/60">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                              No
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
          {!loading && items.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100/80 bg-slate-50/30 px-5 py-3.5 sm:flex-row items-center sm:justify-between">
              <p className="text-[11px] text-slate-400">
                Menampilkan{" "}
                <span className="font-bold text-slate-600">
                  {pageInfo.start}–{pageInfo.end}
                </span>{" "}
                dari <span className="font-bold text-slate-600">{totalItems.toLocaleString("id-ID")}</span> order
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

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}
