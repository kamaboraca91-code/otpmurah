import React from "react";
import { sileo } from "sileo";
import { adminFetch } from "../../lib/adminApi";
import { Button, Card, Icon, Input } from "../../components/ui";

type PricingDTO = {
  id: string;
  profitPercent: number;
  usdToIdrRate: number;
  updatedAt?: string;
};

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function toNum(v: string, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function minDelay<T>(promise: Promise<T>, ms = 600): Promise<T> {
  return Promise.all([
    promise,
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]).then(([result]) => result);
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-md bg-slate-100", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export default function PricingSettings() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [profitPercent, setProfitPercent] = React.useState("");
  const [usdToIdrRate, setUsdToIdrRate] = React.useState("");
  const [server, setServer] = React.useState<PricingDTO | null>(null);

  const dirty = React.useMemo(() => {
    if (!server) return false;
    const p = toNum(profitPercent, server.profitPercent);
    const r = toNum(usdToIdrRate, server.usdToIdrRate);
    return p !== server.profitPercent || r !== server.usdToIdrRate;
  }, [profitPercent, usdToIdrRate, server]);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/settings/pricing", { method: "GET" }).then(
        (res) => res.json() as Promise<PricingDTO>
      );
      setServer(data);
      setProfitPercent(String(data.profitPercent));
      setUsdToIdrRate(String(data.usdToIdrRate));
    } catch (e: any) {
      sileo.error({
        title: "Gagal load",
        description: e?.message ?? "Tidak bisa mengambil data pricing settings.",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    const promise = minDelay(
      (async () => {
        const payload = {
          profitPercent: clamp(toNum(profitPercent, 0), 0, 100),
          usdToIdrRate: clamp(Math.round(toNum(usdToIdrRate, 0)), 1, 1e9),
        };
        const res = await adminFetch("/admin/settings/pricing", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        const updated = (await res.json()) as PricingDTO;
        setServer(updated);
        setProfitPercent(String(updated.profitPercent));
        setUsdToIdrRate(String(updated.usdToIdrRate));
        return updated;
      })(),
      600
    );

    try {
      await sileo.promise(promise, {
        loading: { title: "Menyimpan...", description: "Tunggu sebentar ya." },
        success: { title: "Tersimpan", description: "Pricing settings berhasil diupdate." },
        error: { title: "Gagal menyimpan", description: "Cek input atau koneksi server." },
      });
    } finally {
      setSaving(false);
    }
  }

  function resetToServer() {
    if (!server) return;
    setProfitPercent(String(server.profitPercent));
    setUsdToIdrRate(String(server.usdToIdrRate));
    sileo.info({
      title: "Reset",
      description: "Perubahan dibatalkan dan kembali ke nilai terakhir tersimpan.",
      position: "top-center",
    });
  }

  // Preview calculation
  const previewProfit = toNum(profitPercent, 0);
  const previewRate = toNum(usdToIdrRate, 0);
  const exampleUsd = 1;
  const exampleIdr = previewRate > 0 ? exampleUsd * previewRate : 0;
  const exampleWithProfit = exampleIdr > 0 ? exampleIdr + exampleIdr * (previewProfit / 100) : 0;

  return (
    <>
      <div className="flex items-center justify-center">
        {/* ════════ MAIN SETTINGS CARD ════════ */}
        <Card className="!p-0 w-2xl overflow-hidden border-0 shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex gap-3 flex-row justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon
                    name="iconify:solar:dollar-minimalistic-bold-duotone"
                    className="h-4.5 w-4.5 text-white"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Pricing Settings</h2>
                  <p className="text-[11px] text-slate-400">
                    {loading
                      ? "Memuat data..."
                      : server?.updatedAt
                        ? `Terakhir update: ${new Date(server.updatedAt).toLocaleString("id-ID")}`
                        : "Atur profit dan rate konversi"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {dirty && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Unsaved Changes
                  </span>
                )}
                {!dirty && !loading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Saved
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-5 space-y-5">
            {loading ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : (
              <>
                <Input
                  label="Profit Percent (%)"
                  placeholder="10"
                  value={profitPercent}
                  onChange={(e) => setProfitPercent(e.target.value)}
                  leftIcon="iconify:solar:graph-up-bold-duotone"
                  hint="Range 0 – 100. Margin keuntungan yang ditambahkan ke harga dasar."
                  disabled={saving}
                />

                <Input
                  label="USD → IDR Rate"
                  placeholder="16000"
                  value={usdToIdrRate}
                  onChange={(e) => setUsdToIdrRate(e.target.value)}
                  leftIcon="iconify:solar:transfer-horizontal-bold-duotone"
                  hint="Kurs konversi harga dari USD ke IDR."
                  disabled={saving}
                />

                {/* Preview Card */}
                {previewRate > 0 && (
                  <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                        <Icon
                          name="iconify:solar:calculator-bold-duotone"
                          className="h-4 w-4 text-blue-500"
                        />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Preview Kalkulasi</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-white border border-slate-100 p-3 text-center">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Base (USD)
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">${exampleUsd}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 p-3 text-center">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Converted
                        </p>
                        <p className="mt-1 text-sm font-bold text-blue-600">
                          {formatMoney(exampleIdr)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">
                          + Profit ({previewProfit}%)
                        </p>
                        <p className="mt-1 text-sm font-bold text-emerald-700">
                          {formatMoney(exampleWithProfit)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2.5 text-[10px] text-slate-400 text-center">
                      $1 USD × {formatMoney(previewRate)} × (1 + {previewProfit}%) ={" "}
                      <span className="font-bold text-emerald-600">
                        {formatMoney(exampleWithProfit)}
                      </span>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          {!loading && (
            <div className="flex flex-col gap-3 border-t border-slate-100/80 bg-slate-50/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetToServer}
                  disabled={!dirty || saving}
                  leftIcon="iconify:solar:restart-bold-duotone"
                  className="!h-8 !text-[11px] !font-bold"
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={save}
                  disabled={!dirty || saving}
                  isLoading={saving}
                  leftIcon="iconify:solar:diskette-bold-duotone"
                  className="!h-8 !text-[11px] !font-bold"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                {server?.updatedAt
                  ? `Last saved: ${new Date(server.updatedAt).toLocaleString("id-ID")}`
                  : ""}
              </p>
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