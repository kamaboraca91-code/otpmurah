import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { apiFetch } from "../../lib/api";
import { Badge, Button, Card, DropdownSelect, Icon } from "../../components/ui";

const PAGE_SIZE = 15;

type BalanceMutation = {
  id: string;
  type: string;
  direction: "CREDIT" | "DEBIT";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  createdAt: string;
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
  return d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

function typeLabel(type: string) {
  const x = String(type ?? "").toUpperCase();
  if (x === "TOPUP_CREDIT") return "Topup Masuk";
  if (x === "ORDER_DEBIT") return "Beli Nomor";
  if (x === "ORDER_REFUND") return "Refund Order";
  return x || "-";
}

function typeIcon(type: string): string {
  const x = String(type ?? "").toUpperCase();
  if (x === "TOPUP_CREDIT") return "solar:card-recive-bold-duotone";
  if (x === "ORDER_DEBIT") return "solar:cart-large-minimalistic-bold-duotone";
  if (x === "ORDER_REFUND") return "solar:undo-left-round-bold-duotone";
  return "solar:document-text-bold-duotone";
}

function typeIconColors(type: string): { bg: string; text: string } {
  const x = String(type ?? "").toUpperCase();
  if (x === "TOPUP_CREDIT") return { bg: "bg-emerald-50", text: "text-emerald-500" };
  if (x === "ORDER_DEBIT") return { bg: "bg-amber-50", text: "text-amber-500" };
  if (x === "ORDER_REFUND") return { bg: "bg-blue-50", text: "text-blue-500" };
  return { bg: "bg-slate-50", text: "text-slate-500" };
}

function directionTone(direction: string): "emerald" | "rose" | "slate" {
  const x = String(direction ?? "").toUpperCase();
  if (x === "CREDIT") return "emerald";
  if (x === "DEBIT") return "rose";
  return "slate";
}

export default function BalanceMutationsPage() {
  const [items, setItems] = useState<BalanceMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [summary, setSummary] = useState({ totalCredit: 0, totalDebit: 0, net: 0 });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [tablePageLoading, setTablePageLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      params.set("type", typeFilter);
      params.set("direction", directionFilter);
      if (query.trim()) params.set("q", query.trim());

      const data: any = await apiFetch(`/api/balance-mutations?${params.toString()}`, {
        method: "GET",
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
      setBalance(Number(data?.balance ?? 0));
      setSummary({
        totalCredit: Number(data?.summary?.totalCredit ?? 0),
        totalDebit: Number(data?.summary?.totalDebit ?? 0),
        net: Number(data?.summary?.net ?? 0),
      });
      setTotalPages(Math.max(1, Number(data?.pagination?.totalPages ?? 1)));
      setTotalItems(Number(data?.pagination?.totalItems ?? 0));
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat mutasi saldo",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, directionFilter, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, directionFilter]);

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

  const tableLoading = loading || tablePageLoading;
  const empty = !tableLoading && items.length === 0;

  const pageInfo = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalItems);
    return { start, end };
  }, [page, totalItems]);

  const copyText = useCallback(async (text: string) => {
    const t = String(text ?? "").trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      sileo.success({ title: "Disalin", description: t, position: "top-center" });
    } catch {
      sileo.error({
        title: "Gagal copy",
        description: "Browser menolak akses clipboard.",
        position: "top-center",
      });
    }
  }, []);

  const directionBgColor: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    rose: "bg-rose-50 text-rose-700 ring-rose-200/60",
    slate: "bg-slate-50 text-slate-600 ring-slate-200/60",
  };

  const directionDotColor: Record<string, string> = {
    emerald: "bg-emerald-400",
    rose: "bg-rose-400",
    slate: "bg-slate-400",
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Saldo Saat Ini",
            value: formatMoney(balance),
            icon: "solar:wallet-bold-duotone",
            color: "from-emerald-500 to-green-600",
            bgLight: "bg-blue-50",
            textColor: "text-blue-600",
          },
          {
            label: "Total Kredit",
            value: formatMoney(summary.totalCredit),
            icon: "solar:add-circle-bold-duotone",
            color: "from-emerald-500 to-green-600",
            bgLight: "bg-emerald-50",
            textColor: "text-emerald-600",
          },
          {
            label: "Total Debit",
            value: formatMoney(summary.totalDebit),
            icon: "solar:minus-circle-bold-duotone",
            color: "from-rose-500 to-red-600",
            bgLight: "bg-rose-50",
            textColor: "text-rose-600",
          },
          {
            label: "Net Flow",
            value: formatMoney(summary.net),
            icon: "solar:chart-square-bold-duotone",
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
      <Card className="!p-0 overflow-hidden border-0 shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/20">
                <Icon name="iconify:solar:sort-vertical-bold" className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Mutasi Saldo</h2>
                <p className="text-[11px] text-slate-400">
                  {loading ? "Memuat data..." : `${totalItems} transaksi ditemukan`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="border-b border-slate-100/80 px-5 py-3">
          <div className="grid gap-2.5 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative group">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                <Icon name="search" className="h-4 w-4 mb-[3px]" />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari tipe, referensi, deskripsi..."
                className="w-full h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm"
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
              value={typeFilter}
              onChange={setTypeFilter}
              leftIcon="iconify:solar:filter-bold-duotone"
              options={[
                { value: "ALL", label: "Semua Tipe" },
                { value: "TOPUP_CREDIT", label: "Topup Masuk" },
                { value: "ORDER_DEBIT", label: "Beli Nomor" },
                { value: "ORDER_REFUND", label: "Refund Order" },
              ]}
            />

            <DropdownSelect
              value={directionFilter}
              onChange={setDirectionFilter}
              leftIcon="iconify:solar:square-transfer-horizontal-bold-duotone"
              options={[
                { value: "ALL", label: "Semua Arah" },
                { value: "CREDIT", label: "Kredit (Masuk)" },
                { value: "DEBIT", label: "Debit (Keluar)" },
              ]}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100/80 bg-slate-50/40">
                {["Waktu", "Tipe", "Arah", "Jumlah", "Saldo", "Keterangan"].map((h) => (
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
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="space-y-1.5">
                        <div className="h-3 w-28 rounded-md bg-slate-100/80" />
                        <div className="h-2.5 w-16 rounded-md bg-slate-100/80" />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-slate-100/80" />
                        <div className="h-3.5 w-20 rounded-md bg-slate-100/80" />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-6 w-20 rounded-full bg-slate-100/80" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-6 w-24 rounded-lg bg-slate-100/80" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <div className="h-3 w-32 rounded-md bg-slate-100/80" />
                        <div className="h-2.5 w-24 rounded-md bg-slate-100/80" />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-3 w-40 rounded-md bg-slate-100/80" />
                    </td>
                  </tr>
                ))
              ) : empty ? (
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                        <Icon
                          name="iconify:solar:inbox-line-bold-duotone"
                          className="h-7 w-7 text-slate-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-500">Tidak ada mutasi</p>
                        <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                          Belum ada mutasi saldo yang cocok dengan filter yang dipilih
                        </p>
                      </div>
                      {(query || typeFilter !== "ALL" || directionFilter !== "ALL") && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setQuery("");
                            setTypeFilter("ALL");
                            setDirectionFilter("ALL");
                          }}
                          className="!h-8 mt-1 gap-1.5 !text-[11px]"
                        >
                          <Icon name="iconify:solar:close-circle-bold" className="h-3.5 w-3.5" />
                          Reset Filter
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const tone = directionTone(item.direction);
                  const tIcon = typeIconColors(item.type);
                  const isCredit = item.direction === "CREDIT";

                  return (
                    <tr
                      key={item.id}
                      className="group align-top transition-all duration-200 hover:bg-blue-50/20"
                    >
                      {/* Waktu */}
                      <td className="px-5 py-4">
                        <div className="text-xs font-medium text-slate-700">
                          {formatTime(item.createdAt)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {relativeTime(item.createdAt)}
                        </div>
                        {item.referenceId && (
                          <button
                            onClick={() => copyText(item.referenceId!)}
                            className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-600"
                            title="Copy Reference ID"
                          >
                            <Icon name="iconify:solar:copy-linear" className="h-2.5 w-2.5" />
                            {item.referenceId}
                          </button>
                        )}
                      </td>

                      {/* Tipe */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2.5">
                          <div
                            className={cx(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100/80 shadow-sm",
                              tIcon.bg
                            )}
                          >
                            <Icon name={`iconify:${typeIcon(item.type)}`} className={cx("h-4 w-4", tIcon.text)} />
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            {typeLabel(item.type)}
                          </span>
                        </div>
                      </td>

                      {/* Arah */}
                      <td className="px-5 py-4">
                        <span
                          className={cx(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1",
                            directionBgColor[tone]
                          )}
                        >
                          <span className={cx("h-1.5 w-1.5 rounded-full", directionDotColor[tone])} />
                          {isCredit ? "Kredit" : "Debit"}
                        </span>
                      </td>

                      {/* Jumlah */}
                      <td className="px-5 py-4">
                        <span
                          className={cx(
                            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold",
                            isCredit
                              ? "bg-emerald-50/80 text-emerald-700"
                              : "bg-rose-50/80 text-rose-700"
                          )}
                        >
                          <Icon
                            name={
                              isCredit
                                ? "iconify:solar:arrow-down-left-bold"
                                : "iconify:solar:arrow-up-right-bold"
                            }
                            className="h-3 w-3"
                          />
                          {isCredit ? "+" : "-"}
                          {formatMoney(item.amount)}
                        </span>
                      </td>

                      {/* Saldo */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400">Sebelum:</span>
                            <span className="font-semibold text-slate-600">
                              {formatMoney(item.balanceBefore)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400">Sesudah:</span>
                            <span
                              className={cx(
                                "font-bold",
                                item.balanceAfter >= item.balanceBefore
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              )}
                            >
                              {formatMoney(item.balanceAfter)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="px-5 py-4">
                        <div className="text-xs font-medium text-slate-700 max-w-[240px] truncate">
                          {item.description || (
                            <span className="text-slate-300 italic">Tidak ada keterangan</span>
                          )}
                        </div>
                        {item.referenceType && (
                          <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 ring-1 ring-slate-100">
                            <Icon name="iconify:solar:tag-linear" className="h-2.5 w-2.5" />
                            {item.referenceType}
                          </div>
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
        {!loading && !empty && (
          <div className="flex flex-col gap-3 border-t border-slate-100/80 bg-slate-50/30 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-400">
              Menampilkan{" "}
              <span className="font-bold text-slate-600">
                {pageInfo.start}–{pageInfo.end}
              </span>{" "}
              dari <span className="font-bold text-slate-600">{totalItems}</span> data
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
