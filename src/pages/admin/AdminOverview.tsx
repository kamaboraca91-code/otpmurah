import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { adminFetch } from "../../lib/adminApi";
import { Button, Card, Icon } from "../../components/ui";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TimelinePoint = {
  key: string;
  label: string;
  orderCount: number;
  depositCount: number;
  orderAmount: number;
  depositAmount: number;
  refundAmount: number;
  netProfit: number;
};

type OverviewResponse = {
  summary: {
    totalUsers: number;
    totalOrders: number;
    totalOrderSuccess: number;
    totalOrderWaiting: number;
    totalOrderError: number;
    totalTopups: number;
    totalTopupPending: number;
    totalTopupPaid: number;
    totalBalance: number;
    totalOrderAmount: number;
    totalProfit: number;
    totalTopupAmount: number;
  };
  analytics?: {
    days: number;
    timeline: TimelinePoint[];
  };
};

type OverviewApiResponse = {
  ok?: boolean;
  summary?: Partial<OverviewResponse["summary"]>;
  analytics?: Partial<OverviewResponse["analytics"]> & {
    timeline?: TimelinePoint[];
  };
  data?: {
    summary?: Partial<OverviewResponse["summary"]>;
    analytics?: Partial<OverviewResponse["analytics"]> & {
      timeline?: TimelinePoint[];
    };
  };
};

const DAY_OPTIONS = [7, 14, 30];

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

function compactMoney(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  if (Math.abs(x) >= 1_000_000_000) return `${(x / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(x) >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (Math.abs(x) >= 1_000) return `${(x / 1_000).toFixed(1)}K`;
  return `${x}`;
}

function normalizeOverview(raw: OverviewApiResponse | null | undefined): OverviewResponse {
  const source = raw?.data ?? raw ?? {};
  const summary = source.summary ?? {};
  const analytics = source.analytics;

  return {
    summary: {
      totalUsers: Number(summary.totalUsers ?? 0),
      totalOrders: Number(summary.totalOrders ?? 0),
      totalOrderSuccess: Number(summary.totalOrderSuccess ?? 0),
      totalOrderWaiting: Number(summary.totalOrderWaiting ?? 0),
      totalOrderError: Number(summary.totalOrderError ?? 0),
      totalTopups: Number(summary.totalTopups ?? 0),
      totalTopupPending: Number(summary.totalTopupPending ?? 0),
      totalTopupPaid: Number(summary.totalTopupPaid ?? 0),
      totalBalance: Number(summary.totalBalance ?? 0),
      totalOrderAmount: Number(summary.totalOrderAmount ?? 0),
      totalProfit: Number(summary.totalProfit ?? 0),
      totalTopupAmount: Number(summary.totalTopupAmount ?? 0),
    },
    analytics: analytics
      ? {
          days: Number(analytics.days ?? 14),
          timeline: Array.isArray(analytics.timeline) ? analytics.timeline : [],
        }
      : undefined,
  };
}

function ChartTooltip({
  active,
  payload,
  label,
  isMoney = false,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  isMoney?: boolean;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
      <p className="text-[11px] font-bold text-slate-700">{label}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry, idx) => {
          const name = String(entry.name ?? "-");
          const value = Number(entry.value ?? 0);
          const color = String(entry.color ?? "#94a3b8");
          return (
            <div key={`${name}-${idx}`} className="flex items-center justify-between gap-4 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                {name}
              </span>
              <span className="font-bold text-slate-800">
                {isMoney ? formatMoney(value) : value.toLocaleString("id-ID")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [data, setData] = useState<OverviewResponse | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch(`/admin/monitor/overview?days=${days}`, { method: "GET" });
      const json = (await res.json()) as OverviewApiResponse;
      setData(normalizeOverview(json));
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat admin overview",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;
  const chartData = useMemo(() => data?.analytics?.timeline ?? [], [data?.analytics?.timeline]);

  const totalProfitInChart = useMemo(
    () => chartData.reduce((sum, x) => sum + Number(x.netProfit ?? 0), 0),
    [chartData]
  );
  const totalRefundInChart = useMemo(
    () => chartData.reduce((sum, x) => sum + Number(x.refundAmount ?? 0), 0),
    [chartData]
  );

  return (
    <div className="space-y-6">
      {/* ════════ STATS CARDS ════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Users",
            value: loading ? null : String(summary?.totalUsers ?? 0),
            icon: "solar:users-group-rounded-bold-duotone",
            color: "from-blue-500 to-indigo-600",
            bgLight: "bg-blue-50",
            textColor: "text-blue-600",
          },
          {
            label: "Total Orders",
            value: loading ? null : String(summary?.totalOrders ?? 0),
            icon: "solar:cart-large-minimalistic-bold-duotone",
            color: "from-emerald-500 to-green-600",
            bgLight: "bg-emerald-50",
            textColor: "text-emerald-600",
          },
          {
            label: "Topups",
            value: loading ? null : String(summary?.totalTopups ?? 0),
            icon: "solar:card-recive-bold-duotone",
            color: "from-violet-500 to-purple-600",
            bgLight: "bg-violet-50",
            textColor: "text-violet-600",
          },
          {
            label: "Total Profit",
            value: loading ? null : formatMoney(summary?.totalProfit ?? 0),
            icon: "solar:wallet-bold-duotone",
            color: "from-rose-500 to-red-600",
            bgLight: "bg-rose-50",
            textColor: "text-rose-600",
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

      {/* ════════ CHARTS ════════ */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Order & Deposit Chart */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon
                    name="iconify:solar:graph-new-bold-duotone"
                    className="h-4.5 w-4.5 text-white"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Order & Deposit</h2>
                  <p className="text-[11px] text-slate-400">Volume transaksi harian</p>
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
              <div className="h-[200px] rounded-xl bg-slate-50/60 border border-slate-100 animate-pulse flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-slate-200/70" />
                  <div className="h-3 w-24 rounded-md bg-slate-200/70" />
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                  <Icon
                    name="iconify:solar:graph-new-bold-duotone"
                    className="h-6 w-6 text-slate-300"
                  />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">Belum ada data</p>
                <p className="mt-1 text-xs text-slate-400">Data analisis belum tersedia</p>
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="transparent" horizontal={false} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11, color: "#475569", paddingBottom: 8 }}
                    />
                    <Bar dataKey="orderCount" name="Order" fill="#64748b" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="depositCount" name="Deposit" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>

        {/* Profit Chart */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
                <Icon
                  name="iconify:solar:chart-2-bold-duotone"
                  className="h-4.5 w-4.5 text-white"
                />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Profit & Refund</h2>
                <p className="text-[11px] text-slate-400">Net profit harian</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Mini Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50/80 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className="text-[11px] text-slate-500">Profit</span>
                <span className="text-[11px] font-bold text-emerald-700">
                  {loading ? "..." : formatMoney(totalProfitInChart)}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-rose-50/80 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                <span className="text-[11px] text-slate-500">Refund</span>
                <span className="text-[11px] font-bold text-rose-700">
                  {loading ? "..." : formatMoney(totalRefundInChart)}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-[200px] rounded-xl bg-slate-50/60 border border-slate-100 animate-pulse flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-slate-200/70" />
                  <div className="h-3 w-24 rounded-md bg-slate-200/70" />
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                  <Icon
                    name="iconify:solar:chart-2-bold-duotone"
                    className="h-6 w-6 text-slate-300"
                  />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">Belum ada data</p>
                <p className="mt-1 text-xs text-slate-400">Data profit belum tersedia</p>
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="netProfitArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="refundArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#fb7185" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="transparent" horizontal={false} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                      tickFormatter={compactMoney}
                    />
                    <Tooltip content={<ChartTooltip isMoney />} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11, color: "#475569", paddingBottom: 8 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="netProfit"
                      name="Net Profit"
                      stroke="#059669"
                      strokeWidth={2}
                      fill="url(#netProfitArea)"
                      activeDot={{ r: 4 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="refundAmount"
                      name="Refund"
                      stroke="#e11d48"
                      strokeWidth={2}
                      fill="url(#refundArea)"
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
