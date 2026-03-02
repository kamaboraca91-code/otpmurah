import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiFetch } from "../../lib/api";
import { sileo } from "sileo";
import { useAuth } from "../../auth/useAuth";
import {
  Icon,
  Button,
  DropdownSelect,
  Badge,
  Card,
  CardHeader,
  Modal,
} from "../../components/ui";

const HISTORY_PAGE_SIZE = 10;

type Topup = {
  id: string;
  reffId: string;
  methodCode: string;
  amount: number;
  totalBayar?: number | null;
  totalDiterima?: number | null;
  status: string;
  providerStatus: string;
  checkoutUrl?: string | null;
  payUrl?: string | null;
  qrLink?: string | null;
  qrString?: string | null;
  nomorVa?: string | null;
  createdAt: string;
  updatedAt: string;
  creditedAt?: string | null;
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

function statusTone(status: string): "emerald" | "amber" | "rose" {
  const s = String(status ?? "").toUpperCase();
  if (s === "PAID") return "emerald";
  if (s === "FAILED" || s === "CANCELED") return "rose";
  return "amber";
}

function statusLabel(status: string): string {
  const s = String(status ?? "").toUpperCase();
  if (s === "PAID") return "Paid";
  if (s === "PENDING") return "Pending";
  if (s === "FAILED") return "Failed";
  if (s === "CANCELED") return "Canceled";
  return status;
}

const statusBgColor: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  amber: "bg-amber-50 text-amber-700 ring-amber-200/60",
  rose: "bg-rose-50 text-rose-700 ring-rose-200/60",
};

const statusDotColor: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
};

/* ─── Quick Amount Chip ─── */
function QuickChip({
  value,
  active,
  onClick,
}: {
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative rounded-xl px-3 py-3 text-xs font-bold transition-all duration-200 cursor-pointer overflow-hidden",
        active
          ? "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/25 scale-[1.02]"
          : "bg-white text-slate-700 border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-700 hover:shadow-sm"
      )}
    >
      {active && (
        <div className="absolute top-0 right-0 h-6 w-6 opacity-20">
          <Icon name="iconify:solar:check-circle-bold" className="h-full w-full" />
        </div>
      )}
      {formatMoney(value)}
    </button>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
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
      {statusLabel(status)}
    </span>
  );
}

export default function DepositPage() {
  const { reloadMe } = useAuth();
  const [items, setItems] = useState<Topup[]>([]);
  const [balance, setBalance] = useState(0);
  const [amountInput, setAmountInput] = useState("10000");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTableLoading, setHistoryTableLoading] = useState(false);
  const [scrollToQrisAfterCreate, setScrollToQrisAfterCreate] = useState(false);
  const qrisDetailRef = useRef<HTMLDivElement | null>(null);

  /* Cancel modal state */
  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    id: string;
    reffId: string;
    amount: number;
  }>({ open: false, id: "", reffId: "", amount: 0 });

  const quickAmounts = [10000, 25000, 50000, 100000, 250000, 500000];

  const upsertItem = useCallback((item: Topup) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === item.id);
      if (idx < 0) return [item, ...prev];
      const copy = prev.slice();
      copy[idx] = item;
      return copy.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, []);

  const pendingItems = useMemo(
    () => items.filter((x) => String(x.status).toUpperCase() === "PENDING"),
    [items]
  );
  const activeInvoice = useMemo(() => pendingItems[0] ?? null, [pendingItems]);

  const filteredItems = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return items.filter((item) => {
      const status = String(item.status ?? "").toUpperCase();
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(item.reffId ?? "").toLowerCase().includes(q) ||
        String(item.methodCode ?? "").toLowerCase().includes(q) ||
        String(item.providerStatus ?? "").toLowerCase().includes(q) ||
        String(item.amount ?? "").includes(q) ||
        String(item.totalBayar ?? "").includes(q)
      );
    });
  }, [items, statusFilter, historyQuery]);

  const totalHistoryPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / HISTORY_PAGE_SIZE)),
    [filteredItems.length]
  );

  const pagedItems = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return filteredItems.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredItems, historyPage]);

  const stats = useMemo(() => {
    const total = items.length;
    const paid = items.filter((i) => i.status.toUpperCase() === "PAID").length;
    const pending = items.filter((i) => i.status.toUpperCase() === "PENDING").length;
    const totalAmount = items
      .filter((i) => i.status.toUpperCase() === "PAID")
      .reduce((sum, i) => sum + (Number(i.totalDiterima ?? i.amount) || 0), 0);
    return { total, paid, pending, totalAmount };
  }, [items]);

  /* ─── API Calls ─── */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await apiJson("/api/topups");
      setItems(Array.isArray(res?.items) ? res.items : []);
      setBalance(Number(res?.balance ?? 0));
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat topup",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const createTopup = useCallback(async () => {
    if (activeInvoice) {
      sileo.warning({
        title: "Masih ada deposit pending",
        description: `Batalkan invoice ${activeInvoice.reffId} dulu sebelum membuat deposit baru.`,
        position: "top-center",
      });
      return;
    }

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < 1000) {
      sileo.warning({
        title: "Nominal tidak valid",
        description: "Minimal topup Rp1.000",
        position: "top-center",
      });
      return;
    }
    try {
      setCreating(true);
      const res: any = await apiJson("/api/topups", {
        method: "POST",
        body: JSON.stringify({ amount, methodCode: "QRIS" }),
      });
      if (res?.item) {
        upsertItem(res.item);
        if (res.item.qrString || res.item.qrLink) {
          setScrollToQrisAfterCreate(true);
        }
      }
      setBalance(Number(res?.balance ?? balance));
      await reloadMe();
      sileo.success({
        title: "Invoice topup dibuat",
        description: "Lanjutkan pembayaran melalui QRIS.",
        position: "top-center",
      });
    } catch (e: any) {
      sileo.error({
        title: "Gagal membuat topup",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setCreating(false);
    }
  }, [activeInvoice, amountInput, upsertItem, balance, reloadMe]);

  const syncOne = useCallback(
    async (id: string) => {
      try {
        setSyncingId(id);
        const res: any = await apiJson(`/api/topups/${id}/sync`, { method: "POST" });
        if (res?.item) upsertItem(res.item);
        if (res?.balance !== undefined) setBalance(Number(res.balance ?? 0));
        await reloadMe();
      } catch (e: any) {
        sileo.error({
          title: "Sync gagal",
          description: e?.message || "Unknown error",
          position: "top-center",
        });
      } finally {
        setSyncingId(null);
      }
    },
    [upsertItem, reloadMe]
  );

  const cancelOne = useCallback(
    async (id: string) => {
      try {
        setCancelingId(id);
        const res: any = await apiJson(`/api/topups/${id}/cancel`, { method: "POST" });
        if (res?.item) upsertItem(res.item);
        if (res?.balance !== undefined) setBalance(Number(res.balance ?? 0));
        sileo.success({
          title: "Invoice dibatalkan",
          description: "Invoice topup berhasil dibatalkan.",
          position: "top-center",
        });
      } catch (e: any) {
        sileo.error({
          title: "Batal invoice gagal",
          description: e?.message || "Unknown error",
          position: "top-center",
        });
      } finally {
        setCancelingId(null);
        setCancelModal({ open: false, id: "", reffId: "", amount: 0 });
      }
    },
    [upsertItem]
  );

  const openCancelModal = useCallback((item: Topup) => {
    setCancelModal({ open: true, id: item.id, reffId: item.reffId, amount: item.amount });
  }, []);

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

  /* ─── Effects ─── */
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const streamUrl = `${API_BASE}/api/topups/stream`;
    const es = new EventSource(streamUrl, { withCredentials: true });
    es.addEventListener("ready", () => setConnected(true));
    es.addEventListener("topup_update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data ?? "{}");
        if (payload?.item) upsertItem(payload.item);
        if (payload?.balance !== undefined) setBalance(Number(payload.balance ?? 0));
        if (payload?.type === "credited") {
          void reloadMe();
          sileo.success({
            title: "Topup berhasil",
            description: "Saldo sudah ditambahkan ke akun kamu.",
            position: "top-center",
          });
        }
      } catch {
        /* ignore */
      }
    });
    es.onerror = () => setConnected(false);
    return () => {
      es.close();
      setConnected(false);
    };
  }, [upsertItem, reloadMe]);

  useEffect(() => {
    if (connected || pendingItems.length === 0) return;
    const timer = setInterval(() => {
      pendingItems.slice(0, 3).forEach((x) => void syncOne(x.id));
    }, 15_000);
    return () => clearInterval(timer);
  }, [connected, pendingItems, syncOne]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyQuery, statusFilter]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) setHistoryPage(totalHistoryPages);
  }, [historyPage, totalHistoryPages]);

  useEffect(() => {
    if (!historyTableLoading) return;
    const timer = window.setTimeout(() => setHistoryTableLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [historyTableLoading]);

  const goToHistoryPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.min(totalHistoryPages, nextPage));
      if (clamped === historyPage) return;
      setHistoryTableLoading(true);
      setHistoryPage(clamped);
    },
    [historyPage, totalHistoryPages]
  );
  const tableLoading = loading || historyTableLoading;

  useEffect(() => {
    if (!scrollToQrisAfterCreate) return;
    if (!activeInvoice) return;
    if (!activeInvoice.qrString && !activeInvoice.qrLink) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) {
      setScrollToQrisAfterCreate(false);
      return;
    }
    const timer = window.setTimeout(() => {
      qrisDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToQrisAfterCreate(false);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeInvoice, scrollToQrisAfterCreate]);

  /* ─── Render ─── */
  return (
    <>
      {/* ════════ CANCEL MODAL ════════ */}
      <Modal
        open={cancelModal.open}
        title="Batalkan Invoice"
        onClose={() => setCancelModal({ open: false, id: "", reffId: "", amount: 0 })}
        footer={
          <>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setCancelModal({ open: false, id: "", reffId: "", amount: 0 })}
            >
              Tidak, Kembali
            </Button>
            <Button
              variant="danger"
              className="w-full"
              isLoading={cancelingId === cancelModal.id}
              onClick={() => cancelOne(cancelModal.id)}
            >
              Ya, Batalkan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200/60 shadow-inner">
            <Icon name="warning" className="h-8 w-8 text-rose-500" />
          </div>

          <div className="text-center space-y-1.5">
            <p className="text-sm text-slate-600">Anda akan membatalkan invoice:</p>
            <button
              onClick={() => copyText(cancelModal.reffId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 font-mono text-sm font-bold text-slate-800 transition-all hover:bg-slate-100"
            >
              {cancelModal.reffId}
              <Icon name="iconify:solar:copy-linear" className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <p className="text-2xl font-bold text-rose-600">{formatMoney(cancelModal.amount)}</p>
          </div>

          <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Icon name="warning" className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Invoice yang sudah dibatalkan tidak bisa
                diaktifkan kembali.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <div className="space-y-6">

        {/* ════════ CREATE + QRIS ════════ */}
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Create Invoice */}
          <Card className="lg:col-span-2 !p-0 overflow-hidden border-0 shadow-sm">
            <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20">
                  <Icon name="bolt" className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Buat Invoice</h2>
                  <p className="text-[11px] text-slate-400">Pilih nominal lalu buat QRIS</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Connection indicator */}
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "h-2 w-2 rounded-full",
                    connected ? "bg-emerald-400 animate-pulse" : "bg-slate-300"
                  )}
                />
                <span className="text-[10px] font-medium text-slate-400">
                  {connected ? "Realtime terhubung" : "Polling mode"}
                </span>
              </div>

              {/* Quick amounts */}
              <div>
                <label className="mb-2.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Nominal Cepat
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((v) => (
                    <QuickChip
                      key={v}
                      value={v}
                      active={amountInput === String(v)}
                      onClick={() => setAmountInput(String(v))}
                    />
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Atau masukkan nominal
                </label>
                <div className="relative group">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-300 pointer-events-none transition-colors group-focus-within:text-teal-500">
                    Rp
                  </span>
                  <input
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="10000"
                    className="w-full h-11 rounded-xl border border-slate-200/80 bg-slate-50/50 pl-11 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:shadow-sm"
                  />
                </div>
              </div>

              {/* Submit */}
              <Button
                className="w-full !h-11 !text-sm !font-bold"
                isLoading={creating}
                disabled={Boolean(activeInvoice)}
                onClick={createTopup}
                leftIcon="iconify:solar:add-circle-bold-duotone"
              >
                Buat Invoice QRIS
              </Button>

              {activeInvoice && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/80 p-3.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <Icon name="warning" className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Masih ada invoice pending{" "}
                    <span className="font-bold">{activeInvoice.reffId}</span>. Batalkan dulu
                    invoice tersebut untuk membuat deposit baru.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* QRIS Detail */}
          <div ref={qrisDetailRef} className="lg:col-span-3">
            <Card className="!p-0 overflow-hidden border-0 shadow-sm h-full">
              <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                    <Icon
                      name="iconify:solar:qr-code-bold-duotone"
                      className="h-4.5 w-4.5 text-white"
                    />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Detail QRIS</h2>
                    <p className="text-[11px] text-slate-400">Scan QR code untuk pembayaran</p>
                  </div>
                </div>
              </div>

              {!activeInvoice ? (
                <div className="flex flex-col items-center justify-center px-6 py-20">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                    <Icon
                      name="iconify:solar:qr-code-bold-duotone"
                      className="h-9 w-9 text-slate-300"
                    />
                  </div>
                  <p className="text-sm font-bold text-slate-500">Belum ada invoice aktif</p>
                  <p className="mt-1 text-xs text-slate-400 max-w-[220px] text-center leading-relaxed">
                    Buat invoice terlebih dahulu untuk menampilkan QR Code pembayaran
                  </p>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    {/* QR Image */}
                    {(activeInvoice.qrString || activeInvoice.qrLink) && (
                      <div className="shrink-0">
                        <div className="relative overflow-hidden flex justify-center rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.03)_0%,transparent_70%)]" />
                          <img
                            src={activeInvoice.qrString || activeInvoice.qrLink || ""}
                            alt="QRIS"
                            className="relative h-52 w-52 object-contain"
                          />
                        </div>
                        <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
                          Scan dengan aplikasi e-wallet
                        </p>
                      </div>
                    )}

                    {/* Info panel */}
                    <div className="flex flex-1 flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => copyText(activeInvoice.reffId)}
                          className="group/inv inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-600 transition-all hover:bg-slate-100"
                        >
                          {activeInvoice.reffId}
                          <Icon
                            name="iconify:solar:copy-linear"
                            className="h-3 w-3 text-slate-400 opacity-0 transition-opacity group-hover/inv:opacity-100"
                          />
                        </button>
                        <StatusBadge status={activeInvoice.status} />
                      </div>

                      <div className="space-y-0 rounded-xl bg-slate-50/80 border border-slate-200/60 divide-y divide-slate-200/60 overflow-hidden">
                        {[
                          {
                            label: "Nominal",
                            value: formatMoney(activeInvoice.amount),
                            bold: true,
                          },
                          {
                            label: "Total Bayar",
                            value: formatMoney(activeInvoice.totalBayar ?? activeInvoice.amount),
                            bold: true,
                            highlight: true,
                          },
                          {
                            label: "Metode",
                            value: activeInvoice.methodCode,
                          },
                          {
                            label: "Dibuat",
                            value: formatTime(activeInvoice.createdAt),
                          },
                        ].map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center justify-between px-4 py-3"
                          >
                            <span className="text-xs text-slate-500">{row.label}</span>
                            <span
                              className={cx(
                                "text-sm",
                                row.bold ? "font-bold" : "font-medium",
                                row.highlight ? "text-emerald-700" : "text-slate-800"
                              )}
                            >
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={syncingId === activeInvoice.id}
                          disabled={
                            syncingId === activeInvoice.id || cancelingId === activeInvoice.id
                          }
                          onClick={() => syncOne(activeInvoice.id)}
                          leftIcon="iconify:solar:refresh-bold-duotone"
                          className="w-full"
                        >
                          Cek Pembayaran
                        </Button>

                        {String(activeInvoice.status).toUpperCase() === "PENDING" && (
                          <Button
                            variant="danger"
                            size="sm"
                            className="w-full"
                            disabled={
                              cancelingId === activeInvoice.id || syncingId === activeInvoice.id
                            }
                            isLoading={cancelingId === activeInvoice.id}
                            onClick={() => openCancelModal(activeInvoice)}
                            leftIcon="x"
                          >
                            Batalkan
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Security info */}
                  <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-teal-50/80 to-emerald-50/50 border border-teal-200/40 mt-5 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100/80">
                      <Icon name="shield" className="h-4 w-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-teal-800">Pembayaran Aman</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-teal-700/80">
                        Saldo otomatis masuk setelah pembayaran dikonfirmasi provider. Proses
                        biasanya kurang dari 1 menit.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ════════ HISTORY ════════ */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon name="iconify:solar:history-bold" className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Riwayat Topup</h2>
                  <p className="text-[11px] text-slate-400">
                    {loading
                      ? "Memuat data..."
                      : `${filteredItems.length} transaksi ditemukan`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="border-b border-slate-100/80 px-5 py-3">
            <div className="grid gap-2.5 sm:grid-cols-[1fr_200px]">
              <div className="relative group">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                  <Icon name="search" className="h-4 w-4" />
                </span>
                <input
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Cari invoice, metode, nominal..."
                  className="w-full h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm"
                />
                {historyQuery && (
                  <button
                    onClick={() => setHistoryQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    <Icon name="iconify:solar:close-circle-bold" className="h-4 w-4" />
                  </button>
                )}
              </div>
              <DropdownSelect
                value={statusFilter}
                onChange={setStatusFilter}
                leftIcon="iconify:solar:filter-bold-duotone"
                options={[
                  { value: "ALL", label: "Semua Status" },
                  { value: "PENDING", label: "Pending" },
                  { value: "PAID", label: "Paid" },
                  { value: "FAILED", label: "Failed" },
                  { value: "CANCELED", label: "Canceled" },
                ]}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100/80 bg-slate-50/40">
                  {["Invoice", "Waktu", "Nominal", "Total Bayar", "Status", "Aksi"].map((h) => (
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
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-36 rounded-md bg-slate-100/80" />
                          <div className="h-4 w-14 rounded-md bg-slate-100/80" />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="h-3 w-28 rounded-md bg-slate-100/80" />
                          <div className="h-2.5 w-16 rounded-md bg-slate-100/80" />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-6 w-24 rounded-lg bg-slate-100/80" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-6 w-24 rounded-lg bg-slate-100/80" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-6 w-20 rounded-full bg-slate-100/80" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-8 w-24 rounded-lg bg-slate-100/80" />
                      </td>
                    </tr>
                  ))
                ) : filteredItems.length === 0 ? (
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
                          <p className="text-sm font-bold text-slate-500">Tidak ada data</p>
                          <p className="text-xs text-slate-400 max-w-[220px] mx-auto leading-relaxed">
                            Tidak ada riwayat topup sesuai filter saat ini
                          </p>
                        </div>
                        {(historyQuery || statusFilter !== "ALL") && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setHistoryQuery("");
                              setStatusFilter("ALL");
                            }}
                            className="!h-8 mt-1 gap-1.5 !text-[11px]"
                          >
                            <Icon
                              name="iconify:solar:close-circle-bold"
                              className="h-3.5 w-3.5"
                            />
                            Reset Filter
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedItems.map((item) => {
                    const statusUpper = String(item.status).toUpperCase();
                    const isCanceling = cancelingId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className="group align-top transition-all duration-200 hover:bg-amber-50/20"
                      >
                        {/* Invoice */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => copyText(item.reffId)}
                            className="group/inv inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-700 transition-all hover:bg-amber-50 hover:text-amber-700 hover:shadow-sm"
                          >
                            {item.reffId}
                            <Icon
                              name="iconify:solar:copy-linear"
                              className="h-3 w-3 opacity-0 transition-opacity group-hover/inv:opacity-100"
                            />
                          </button>
                          <div className="mt-1.5 inline-flex items-center rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 ring-1 ring-slate-200/60">
                            {item.methodCode}
                          </div>
                        </td>

                        {/* Waktu */}
                        <td className="px-5 py-4">
                          <div className="text-xs font-medium text-slate-700">
                            {formatTime(item.createdAt)}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {relativeTime(item.createdAt)}
                          </div>
                        </td>

                        {/* Nominal */}
                        <td className="px-5 py-4">
                          <span className="text-xs font-bold text-slate-800">
                            {formatMoney(item.amount)}
                          </span>
                        </td>

                        {/* Total Bayar */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-lg bg-emerald-50/80 px-2 py-1 text-xs font-bold text-emerald-700">
                            {formatMoney(item.totalBayar ?? item.amount)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <StatusBadge status={item.status} />
                        </td>

                        {/* Aksi */}
                        <td className="px-5 py-4">
                          {statusUpper === "PENDING" ? (
                            <Button
                              variant="danger"
                              size="sm"
                              isLoading={isCanceling}
                              disabled={isCanceling}
                              onClick={() => openCancelModal(item)}
                              leftIcon="x"
                              className="!h-8 !text-[11px]"
                            >
                              Batalkan
                            </Button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                              <Icon
                                name="iconify:solar:minus-circle-linear"
                                className="h-3.5 w-3.5"
                              />
                              —
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
            <div className="flex flex-col gap-3 border-t border-slate-100/80 bg-slate-50/30 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-400">
                Menampilkan{" "}
                <span className="font-bold text-slate-600">
                  {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–
                  {Math.min(historyPage * HISTORY_PAGE_SIZE, filteredItems.length)}
                </span>{" "}
                dari <span className="font-bold text-slate-600">{filteredItems.length}</span> data
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tableLoading || historyPage <= 1}
                  onClick={() => goToHistoryPage(1)}
                  className="!h-8 !w-8 !p-0 !text-[11px]"
                  title="Halaman pertama"
                >
                  <Icon name="iconify:solar:alt-arrow-left-bold" className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tableLoading || historyPage <= 1}
                  onClick={() => goToHistoryPage(historyPage - 1)}
                  className="!h-8 !text-[11px] !font-semibold gap-1"
                >
                  <Icon name="iconify:solar:arrow-left-linear" className="h-3 w-3" />
                  Prev
                </Button>

                <div className="flex items-center gap-0.5 mx-1">
                  {Array.from({ length: totalHistoryPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalHistoryPages <= 5) return true;
                      if (p === 1 || p === totalHistoryPages) return true;
                      if (Math.abs(p - historyPage) <= 1) return true;
                      return false;
                    })
                    .reduce<(number | "dots")[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("dots");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "dots" ? (
                        <span
                          key={`dots-${i}`}
                          className="px-1 text-[10px] text-slate-300 select-none"
                        >
                          •••
                        </span>
                      ) : (
                        <button
                          key={p}
                          disabled={tableLoading}
                          onClick={() => goToHistoryPage(p)}
                          className={cx(
                            "flex h-8 min-w-[32px] items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
                            historyPage === p
                              ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tableLoading || historyPage >= totalHistoryPages}
                  onClick={() => goToHistoryPage(historyPage + 1)}
                  className="!h-8 !text-[11px] !font-semibold gap-1"
                >
                  Next
                  <Icon name="iconify:solar:arrow-right-linear" className="h-3 w-3" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tableLoading || historyPage >= totalHistoryPages}
                  onClick={() => goToHistoryPage(totalHistoryPages)}
                  className="!h-8 !w-8 !p-0 !text-[11px]"
                  title="Halaman terakhir"
                >
                  <Icon name="iconify:solar:alt-arrow-right-bold" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
