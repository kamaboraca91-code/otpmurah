import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiFetch } from "../../lib/api";
import { sileo } from "sileo";
import { Icon, Button, Card, Modal } from "../../components/ui";

const CANCEL_UNLOCK_DELAY_MS = 130 * 1000;
const AUTO_CANCEL_RETRY_MS = 10_000;
const AUTO_COMPLETE_RETRY_MS = 10_000;

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
  activationTime?: string | null;
  activationEndTime?: string | null;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string | null;
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
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function parseMaybeDate(input?: string | null) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const normalized = raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeActivationWindow(
  createdAtRaw?: string | null,
  activationTimeRaw?: string | null,
  activationEndTimeRaw?: string | null
) {
  const createdAt = parseMaybeDate(createdAtRaw);
  const activationTime = parseMaybeDate(activationTimeRaw);
  const activationEndTime = parseMaybeDate(activationEndTimeRaw);

  if (!createdAt || !activationTime || !activationEndTime) {
    return { activationTime, activationEndTime };
  }

  const diffMs = createdAt.getTime() - activationTime.getTime();
  const absDiffMs = Math.abs(diffMs);
  const minShiftMs = 2 * 60 * 60 * 1000;
  const maxShiftMs = 12 * 60 * 60 * 1000;

  if (absDiffMs < minShiftMs || absDiffMs > maxShiftMs) {
    return { activationTime, activationEndTime };
  }

  return {
    activationTime: new Date(activationTime.getTime() + diffMs),
    activationEndTime: new Date(activationEndTime.getTime() + diffMs),
  };
}

function serviceIconUrl(code: string) {
  const x = String(code ?? "").trim().toLowerCase();
  return `https://cdn.hero-sms.com/assets/img/service/${encodeURIComponent(x)}0.webp`;
}

function countryIconUrl(id: number) {
  return `https://cdn.hero-sms.com/assets/img/country/${encodeURIComponent(String(id))}.svg`;
}

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isWaitingStatus(status: string) {
  return String(status || "").toUpperCase().includes("WAIT");
}

function isSuccessStatus(status: string) {
  return String(status || "").toUpperCase() === "STATUS_OK";
}

function isCompletedStatus(status: string) {
  return String(status || "").toUpperCase() === "STATUS_COMPLETED";
}

function hasReceivedSms(item?: Pick<NumberOrder, "smsCode" | "smsText"> | null) {
  return !!String(item?.smsCode ?? item?.smsText ?? "").trim();
}

function getTimingState(item: NumberOrder, nowMs: number) {
  const windowTimes = normalizeActivationWindow(
    item.createdAt,
    item.activationTime,
    item.activationEndTime
  );

  const activationStart = windowTimes.activationTime;
  const activationEnd = windowTimes.activationEndTime;
  const remainingMs = activationEnd ? activationEnd.getTime() - nowMs : null;

  const cancelUnlockAt = activationStart
    ? activationStart.getTime() + CANCEL_UNLOCK_DELAY_MS
    : activationEnd
      ? activationEnd.getTime()
      : null;
  const cancelInMs = cancelUnlockAt ? cancelUnlockAt - nowMs : null;
  const canCancel = cancelUnlockAt ? nowMs >= cancelUnlockAt : false;

  return { activationStart, activationEnd, remainingMs, cancelInMs, canCancel };
}

/* â”€â”€â”€ Countdown ring â”€â”€â”€ */
function CountdownRing({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const isLow = pct < 0.2;

  return (
    <div className="relative inline-flex h-16 w-16 items-center justify-center">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-slate-100"
          strokeWidth="3"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          className={cx("transition-all duration-1000", isLow ? "text-rose-500" : "text-teal-500")}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={cx("absolute text-[11px] font-bold", isLow ? "text-rose-600" : "text-teal-700")}>
        {formatCountdown(remainingMs)}
      </span>
    </div>
  );
}



export default function NumbersPage() {
  const [items, setItems] = useState<NumberOrder[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const autoCancelLockRef = useRef<Set<string>>(new Set());
  const autoCancelRetryUntilRef = useRef<Map<string, number>>(new Map());
  const autoCompleteLockRef = useRef<Set<string>>(new Set());
  const autoCompleteRetryUntilRef = useRef<Map<string, number>>(new Map());

  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    id: string;
    phone: string;
    service: string;
  }>({ open: false, id: "", phone: "", service: "" });

  const upsertItem = useCallback((next: NumberOrder) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === next.id);
      if (idx < 0) return [next, ...prev];
      const copy = prev.slice();
      copy[idx] = next;
      return copy.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data: any = await apiJson("/api/numbers");
      setItems(Array.isArray(data?.items) ? data.items : []);
      setBalance(Number(data?.balance ?? 0));
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat numbers",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const syncOne = useCallback(
    async (id: string) => {
      try {
        setSyncingId(id);
        const data: any = await apiJson(`/api/numbers/${id}/sync`, {
          method: "POST",
        });
        if (data?.item) upsertItem(data.item);
        if (data?.balance !== undefined) {
          setBalance(Number(data.balance ?? 0));
        }
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
    [upsertItem]
  );

  const syncOneSilent = useCallback(
    async (id: string) => {
      try {
        const data: any = await apiJson(`/api/numbers/${id}/sync`, { method: "POST" });
        if (data?.item) upsertItem(data.item);
        if (data?.balance !== undefined) setBalance(Number(data.balance ?? 0));
      } catch { /* silent */ }
    },
    [upsertItem]
  );

  const cancelOne = useCallback(
    async (id: string, opts?: { auto?: boolean }) => {
      const isAuto = opts?.auto === true;
      try {
        setCancelingId(id);
        const data: any = await apiJson(`/api/numbers/${id}/cancel`, { method: "POST" });
        if (data?.item) upsertItem(data.item);
        if (data?.balance !== undefined) setBalance(Number(data.balance ?? 0));
        if (!isAuto) {
          sileo.success({ title: "Order dibatalkan", description: "Nomor berhasil dibatalkan.", position: "top-center" });
        }
        return true;
      } catch (e: any) {
        if (!isAuto) {
          sileo.error({ title: "Gagal membatalkan", description: e?.message || "Unknown error", position: "top-center" });
        }
        return false;
      } finally {
        setCancelingId((prev) => (prev === id ? null : prev));
        if (!isAuto) setCancelModal({ open: false, id: "", phone: "", service: "" });
      }
    },
    [upsertItem]
  );

  const completeOne = useCallback(
    async (id: string, opts?: { auto?: boolean }) => {
      const isAuto = opts?.auto === true;
      try {
        setCompletingId(id);
        const data: any = await apiJson(`/api/numbers/${id}/complete`, { method: "POST" });
        if (data?.item) upsertItem(data.item);
        if (!isAuto) {
          sileo.success({ title: "Pesanan diselesaikan", description: "Order ditandai selesai.", position: "top-center" });
        }
        return true;
      } catch (e: any) {
        if (!isAuto) {
          sileo.error({ title: "Gagal menyelesaikan", description: e?.message || "Unknown error", position: "top-center" });
        }
        return false;
      } finally {
        setCompletingId((prev) => (prev === id ? null : prev));
      }
    },
    [upsertItem]
  );

  const openCancelModal = useCallback((item: NumberOrder) => {
    setCancelModal({
      open: true,
      id: item.id,
      phone: item.phoneNumber,
      service: String(item.serviceName ?? item.service).toUpperCase(),
    });
  }, []);

  const copyText = useCallback(async (text: string) => {
    const t = String(text ?? "").trim();
    if (!t) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(t);
      } else {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      sileo.success({ title: "Disalin", description: t, position: "top-center" });
    } catch {
      sileo.error({ title: "Gagal copy", description: "Browser menolak akses clipboard.", position: "top-center" });
    }
  }, []);

  /* â”€â”€â”€ Effects â”€â”€â”€ */
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const streamUrl = `${API_BASE}/api/numbers/stream`;
    const es = new EventSource(streamUrl, { withCredentials: true });
    es.addEventListener("ready", () => setConnected(true));
    es.addEventListener("number_update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data ?? "{}");
        if (payload?.item) upsertItem(payload.item);
        if (payload?.balance !== undefined) setBalance(Number(payload.balance ?? 0));
      } catch { /* ignore */ }
    });
    es.onerror = () => setConnected(false);
    return () => { es.close(); setConnected(false); };
  }, [upsertItem]);

  const visibleItems = useMemo(
    () =>
      items.filter((x) => {
        const s = String(x.status || "").toUpperCase();
        return (isWaitingStatus(s) || isSuccessStatus(s)) && !s.includes("CANCEL") && !isCompletedStatus(s);
      }),
    [items]
  );

  const waitingItems = useMemo(
    () => visibleItems.filter((x) => isWaitingStatus(x.status)),
    [visibleItems]
  );

  useEffect(() => {
    if (visibleItems.length === 0) { setSelectedId(null); return; }
    if (!selectedId || !visibleItems.some((x) => x.id === selectedId)) {
      setSelectedId(visibleItems[0].id);
    }
  }, [visibleItems, selectedId]);

  const selectedItem = useMemo(
    () => visibleItems.find((x) => x.id === selectedId) ?? null,
    [visibleItems, selectedId]
  );

  const selectedTiming = useMemo(
    () => (selectedItem ? getTimingState(selectedItem, nowMs) : null),
    [selectedItem, nowMs]
  );
  const selectedHasSms = useMemo(() => hasReceivedSms(selectedItem), [selectedItem]);
  const selectedIsCompleted = useMemo(
    () => isCompletedStatus(selectedItem?.status ?? ""),
    [selectedItem]
  );

  const cancelReadyCount = useMemo(
    () => waitingItems.filter((item) => !hasReceivedSms(item) && getTimingState(item, nowMs).canCancel).length,
    [waitingItems, nowMs]
  );

  useEffect(() => {
    if (connected) return;
    if (waitingItems.length === 0) return;
    const timer = setInterval(() => {
      waitingItems.slice(0, 3).forEach((item) => void syncOneSilent(item.id));
    }, 15_000);
    return () => clearInterval(timer);
  }, [connected, waitingItems, syncOneSilent]);

  useEffect(() => {
    const activeIds = new Set(waitingItems.map((item) => item.id));
    for (const id of autoCancelLockRef.current) { if (!activeIds.has(id)) autoCancelLockRef.current.delete(id); }
    for (const id of Array.from(autoCancelRetryUntilRef.current.keys())) { if (!activeIds.has(id)) autoCancelRetryUntilRef.current.delete(id); }
  }, [waitingItems]);

  useEffect(() => {
    const visibleIds = new Set(visibleItems.map((item) => item.id));
    for (const id of autoCompleteLockRef.current) { if (!visibleIds.has(id)) autoCompleteLockRef.current.delete(id); }
    for (const id of Array.from(autoCompleteRetryUntilRef.current.keys())) { if (!visibleIds.has(id)) autoCompleteRetryUntilRef.current.delete(id); }
  }, [visibleItems]);

  useEffect(() => {
    if (loading) return;
    if (cancelingId) return;
    const dueItem = waitingItems.find((item) => {
      if (hasReceivedSms(item)) return false;
      const timing = getTimingState(item, nowMs);
      return timing.canCancel && timing.remainingMs !== null && timing.remainingMs <= 0;
    });
    if (!dueItem) return;
    if (autoCancelLockRef.current.has(dueItem.id)) return;
    const retryUntil = autoCancelRetryUntilRef.current.get(dueItem.id) ?? 0;
    if (retryUntil > nowMs) return;
    autoCancelLockRef.current.add(dueItem.id);
    void cancelOne(dueItem.id, { auto: true })
      .then((ok) => {
        if (!ok) { autoCancelRetryUntilRef.current.set(dueItem.id, Date.now() + AUTO_CANCEL_RETRY_MS); return; }
        autoCancelRetryUntilRef.current.delete(dueItem.id);
      })
      .finally(() => { autoCancelLockRef.current.delete(dueItem.id); });
  }, [waitingItems, cancelOne, cancelingId, loading, nowMs]);

  useEffect(() => {
    if (loading) return;
    if (completingId || cancelingId) return;
    const dueItem = visibleItems.find((item) => {
      if (!hasReceivedSms(item)) return false;
      const timing = getTimingState(item, nowMs);
      return timing.remainingMs !== null && timing.remainingMs <= 0;
    });
    if (!dueItem) return;
    if (autoCompleteLockRef.current.has(dueItem.id)) return;
    const retryUntil = autoCompleteRetryUntilRef.current.get(dueItem.id) ?? 0;
    if (retryUntil > nowMs) return;
    autoCompleteLockRef.current.add(dueItem.id);
    void completeOne(dueItem.id, { auto: true })
      .then((ok) => {
        if (!ok) { autoCompleteRetryUntilRef.current.set(dueItem.id, Date.now() + AUTO_COMPLETE_RETRY_MS); return; }
        autoCompleteRetryUntilRef.current.delete(dueItem.id);
      })
      .finally(() => { autoCompleteLockRef.current.delete(dueItem.id); });
  }, [visibleItems, cancelingId, completeOne, completingId, loading, nowMs]);

  return (
    <>
      {/* â•â•â•â•â•â•â•â• CANCEL MODAL â•â•â•â•â•â•â•â• */}
      <Modal
        open={cancelModal.open}
        title="Batalkan Order Nomor"
        onClose={() => setCancelModal({ open: false, id: "", phone: "", service: "" })}
        footer={
          <>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => setCancelModal({ open: false, id: "", phone: "", service: "" })}
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
          <div className="space-y-1.5 text-center">
            <p className="text-sm text-slate-600">Anda akan membatalkan order nomor:</p>
            <button
              onClick={() => copyText(cancelModal.phone)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 font-mono text-lg font-bold text-slate-800 transition-all hover:bg-slate-100"
            >
              {cancelModal.phone}
              <Icon name="iconify:solar:copy-linear" className="h-4 w-4 text-slate-400" />
            </button>
            <p className="text-xs text-slate-500">Service: {cancelModal.service}</p>
          </div>
          <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Icon name="warning" className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <p className="text-xs leading-relaxed text-amber-800">
                Tindakan ini tidak dapat dibatalkan. Saldo akan dikembalikan sesuai kebijakan provider.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <div className="space-y-6">
        
        {/* â•â•â•â•â•â•â•â• 2-COLUMN LAYOUT â•â•â•â•â•â•â•â• */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* â”€â”€â”€â”€ LEFT: Active Numbers List â”€â”€â”€â”€ */}
          <div className="lg:col-span-5">
            <Card className="!p-0 overflow-hidden border-0 shadow-sm">
              <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                      <Icon name="iconify:solar:list-bold-duotone" className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">Data Order</h2>
                      <p className="text-[11px] text-slate-400">
                        {loading ? "Memuat..." : `${visibleItems.length} nomor aktif`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3">
                {loading ? (
                  <div className="space-y-2.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-200/70" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-32 rounded-md bg-slate-200/70" />
                            <div className="h-3 w-44 rounded-md bg-slate-200/70" />
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : visibleItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-20">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                      <Icon name="iconify:solar:phone-bold-duotone" className="h-7 w-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">Tidak ada Data Order</p>
                    <p className="mt-1 text-xs text-slate-400 max-w-[200px] text-center leading-relaxed">
                      Order nomor baru untuk mulai menerima SMS
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[680px] space-y-2 overflow-auto pr-1 scrollbar-thin">
                    {visibleItems.map((item) => {
                      const isActive = selectedId === item.id;
                      const timing = getTimingState(item, nowMs);
                      const itemTotalMs =
                        timing.activationStart && timing.activationEnd
                          ? timing.activationEnd.getTime() - timing.activationStart.getTime()
                          : 0;
                      const itemHasSms = hasReceivedSms(item);

                      return (
                        <>
                          {isActive && (
                            <div className="mt-3.5 space-y-3">
                              <div className="rounded-xl border border-slate-200/60 bg-white p-4">
                                <div className="flex items-center gap-4">
                                  {timing.remainingMs !== null ? (
                                    <CountdownRing
                                      remainingMs={Math.max(0, timing.remainingMs)}
                                      totalMs={itemTotalMs}
                                    />
                                  ) : (
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-200">
                                      <span className="text-sm text-slate-400">-</span>
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <span className="shrink-0 text-slate-400">Mulai:</span>
                                      <span className="truncate font-semibold text-slate-600">
                                        {timing.activationStart
                                          ? formatTime(timing.activationStart.toISOString())
                                          : "-"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <span className="shrink-0 text-slate-400">Berakhir:</span>
                                      <span className="truncate font-semibold text-slate-600">
                                        {timing.activationEnd
                                          ? formatTime(timing.activationEnd.toISOString())
                                          : "-"}
                                      </span>
                                    </div>
                                    {!timing.canCancel && timing.cancelInMs !== null && timing.cancelInMs > 0 && (
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                        <Icon name="iconify:solar:lock-bold-duotone" className="h-3 w-3" />
                                        Batal tersedia dalam {formatCountdown(timing.cancelInMs)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/80">
                                <div className="flex items-center justify-between border-b border-slate-200/60 px-3 py-2.5">
                                  <span className="text-[11px] font-medium text-slate-400">Layanan</span>
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                                    <img
                                      src={serviceIconUrl(item.service)}
                                      alt=""
                                      className="h-4 w-4 rounded object-contain"
                                      loading="lazy"
                                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                    {String(item.serviceName ?? item.service).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-200/60 px-3 py-2.5">
                                  <span className="text-[11px] font-medium text-slate-400">Negara</span>
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                                    <img
                                      src={countryIconUrl(item.country)}
                                      alt=""
                                      className="h-4 w-4 rounded-full object-cover"
                                      loading="lazy"
                                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                    {item.countryName || `Country ${item.country}`}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-200/60 px-3 py-2.5">
                                  <span className="text-[11px] font-medium text-slate-400">Harga</span>
                                  <span className="text-[11px] font-bold text-emerald-700">
                                    {formatMoney(item.pricePaid)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2.5">
                                  <span className="text-[11px] font-medium text-slate-400">Dibuat</span>
                                  <span className="text-[11px] font-semibold text-slate-800">
                                    {formatTime(item.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* â”€â”€â”€â”€ RIGHT: Detail Panel â”€â”€â”€â”€ */}
          <div className="lg:col-span-7">
            <Card className="!p-0 overflow-hidden border-0 shadow-sm lg:sticky lg:top-6">
              <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                      <Icon name="iconify:solar:document-text-bold-duotone" className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">Panel Order</h2>
                      <p className="text-[11px] text-slate-400">
                        {selectedItem ? (
                          <button
                            onClick={() => copyText(selectedItem.activationId)}
                            className="inline-flex items-center gap-1 hover:text-slate-600 transition-colors"
                          >
                            ID: {selectedItem.activationId}
                            <Icon name="iconify:solar:copy-linear" className="h-2.5 w-2.5" />
                          </button>
                        ) : (
                          "Pilih nomor untuk melihat detail"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {loading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                        <div className="h-2.5 w-16 rounded-md bg-slate-200/70" />
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-xl bg-slate-200/70" />
                          <div className="h-4 w-32 rounded-md bg-slate-200/70" />
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                        <div className="h-2.5 w-20 rounded-md bg-slate-200/70" />
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-xl bg-slate-200/70" />
                          <div className="h-4 w-24 rounded-md bg-slate-200/70" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                      <div className="h-16 w-16 mx-auto rounded-full bg-slate-200/70" />
                      <div className="h-3 w-32 mx-auto rounded-md bg-slate-200/70" />
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex justify-between">
                          <div className="h-3 w-16 rounded-md bg-slate-200/70" />
                          <div className="h-3 w-24 rounded-md bg-slate-200/70" />
                        </div>
                      ))}
                    </div>
                    <div className="h-10 w-40 rounded-xl bg-slate-200/70" />
                  </div>
                ) : !selectedItem || !selectedTiming ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-24">
                    <div className="mb-4 flex h-18 w-18 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                      <Icon name="iconify:solar:document-text-bold-duotone" className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">Belum ada nomor dipilih</p>
                    <p className="mt-1 text-xs text-slate-400 max-w-[200px] text-center leading-relaxed">
                      Pilih nomor dari daftar di sebelah kiri
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* â”€â”€ Phone Number + SMS Code â”€â”€ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Phone Number */}
                      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 h-full flex flex-col justify-between">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Nomor Aktif
                        </span>
                        <div className="flex items-center justify-between gap-2 mt-auto">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                              <Icon
                                name="iconify:solar:phone-bold-duotone"
                                className="h-4 w-4"
                              />
                            </span>
                            <span className="text-sm font-bold tracking-wide text-slate-900 truncate">
                              {selectedItem.phoneNumber}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyText(selectedItem.phoneNumber)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer shrink-0"
                          >
                            <Icon
                              name="iconify:solar:copy-bold-duotone"
                              className="h-3 w-3"
                            />
                            Copy
                          </button>
                        </div>
                      </div>

                      {/* SMS Code */}
                      <div
                        className={cx(
                          "rounded-xl border p-4 h-full flex flex-col",
                          selectedItem.smsCode
                            ? "border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-green-50/30"
                            : "border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-orange-50/30"
                        )}
                      >
                        <span
                          className={cx(
                            "text-[10px] font-bold uppercase tracking-wider mb-3",
                            selectedItem.smsCode ? "text-emerald-500" : "text-amber-500"
                          )}
                        >
                          {selectedItem.smsCode ? "Kode SMS Diterima" : "Menunggu Kode SMS"}
                        </span>
                        <div className="flex items-center gap-2.5 mt-auto">
                          <div
                            className={cx(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border overflow-hidden",
                              selectedItem.smsCode
                                ? "border-emerald-200/50 bg-emerald-100"
                                : "border-amber-200/50 bg-amber-100"
                            )}
                          >
                            {selectedItem.smsCode ? (
                              <img
                                src={serviceIconUrl(selectedItem.service)}
                                alt=""
                                className="h-6 w-6 rounded object-contain"
                                loading="lazy"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                              />
                            ) : (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div
                              className={cx(
                                "text-sm font-bold tracking-widest truncate",
                                selectedItem.smsCode ? "text-emerald-700" : "text-amber-600"
                              )}
                            >
                              {selectedItem.smsCode || "Menunggu..."}
                            </div>
                            {selectedItem.smsText && selectedItem.smsText !== selectedItem.smsCode && (
                              <p className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">
                                {selectedItem.smsText}
                              </p>
                            )}
                          </div>
                        </div>
                        {selectedItem.smsCode && (
                          <button
                            type="button"
                            onClick={() => copyText(selectedItem.smsCode ?? "")}
                            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200/60 bg-emerald-100/80 px-2.5 py-2 text-[11px] font-bold text-emerald-700 transition-all hover:bg-emerald-200 hover:shadow-sm cursor-pointer"
                          >
                            <Icon name="iconify:solar:copy-bold-duotone" className="h-3.5 w-3.5" />
                            Salin Kode SMS
                          </button>
                        )}
                      </div>
                    </div>

                    {/* â”€â”€ Actions â”€â”€ */}
                    <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white px-3.5 py-3 sm:grid-cols-2 sm:px-4 sm:py-3.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full whitespace-nowrap"
                        isLoading={syncingId === selectedItem.id}
                        disabled={
                          syncingId === selectedItem.id ||
                          cancelingId === selectedItem.id ||
                          completingId === selectedItem.id
                        }
                        onClick={() => syncOne(selectedItem.id)}
                        leftIcon="iconify:solar:refresh-bold-duotone"
                      >
                        Sync Status
                      </Button>
                      {selectedIsCompleted ? (
                        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/60 sm:justify-start">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          STATUS_COMPLETED
                        </span>
                      ) : selectedHasSms ? (
                        
                        <Button
                          size="sm"
                          disabled={
                            completingId === selectedItem.id ||
                            cancelingId === selectedItem.id
                          }
                          isLoading={completingId === selectedItem.id}
                          onClick={() => completeOne(selectedItem.id)}
                          leftIcon="check"
                          className="w-full whitespace-nowrap !h-9 !text-[11px] sm:!text-xs !font-bold"
                        >
                          Selesaikan Pesanan
                        </Button>
                      ) : selectedTiming.canCancel ? (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={
                            cancelingId === selectedItem.id ||
                            completingId === selectedItem.id
                          }
                          isLoading={cancelingId === selectedItem.id}
                          onClick={() => openCancelModal(selectedItem)}
                          leftIcon="x"
                          className="w-full whitespace-nowrap !h-9 !text-[11px] sm:!text-xs !font-bold"
                        >
                          Batalkan Order
                        </Button>
                      ) : (
                        <span className="inline-flex w-full items-center justify-center gap-1.5 text-center text-[11px] font-medium text-slate-400 sm:justify-start sm:text-left">
                          <Icon name="iconify:solar:lock-bold-duotone" className="h-3.5 w-3.5" />
                          Pembatalan tersedia dalam {formatCountdown(selectedTiming.cancelInMs ?? 0)}
                        </span>
                      )}
                    </div>

                    {/* â”€â”€ Security info â”€â”€ */}
                    <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-teal-50/80 to-emerald-50/50 border border-teal-200/40 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100/80">
                        <Icon name="shield" className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-teal-800">Auto-cancel aktif</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-teal-700/80">
                          Nomor yang tidak menerima SMS akan otomatis dibatalkan saat waktu habis. Saldo dikembalikan sesuai kebijakan.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Scrollbar styles */}
      <style>{`
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
    </>
  );
}
