import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sileo } from "sileo";
import { useAuth } from "../../auth/useAuth";
import { apiFetch } from "../../lib/api";
import { Button, Card, Icon, Input, PasswordInput } from "../../components/ui";

type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
  balance?: number;
  createdAt: string;
};

type SessionInfo = {
  id: string;
  userAgent?: string | null;
  ip?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
};

type SessionResponse = {
  currentSessionId?: string;
  sessions?: SessionInfo[];
};

const SESSIONS_PAGE_SIZE = 4;
type IconifyName = `iconify:${string}`;

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatTime(iso?: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
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

function toPasswordRules(value: string) {
  return {
    length: value.length >= 10 && value.length <= 72,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}

function userAgentLabel(agent?: string | null) {
  const raw = String(agent ?? "").trim();
  if (!raw) return "Unknown device";
  if (raw.length <= 80) return raw;
  return `${raw.slice(0, 80)}…`;
}

function detectDeviceIcon(agent?: string | null): IconifyName {
  const raw = String(agent ?? "").toLowerCase();
  if (raw.includes("mobile") || raw.includes("android") || raw.includes("iphone"))
    return "iconify:solar:smartphone-bold-duotone";
  if (raw.includes("tablet") || raw.includes("ipad"))
    return "iconify:solar:tablet-bold-duotone";
  return "iconify:solar:monitor-bold-duotone";
}

function detectBrowserName(agent?: string | null): string {
  const raw = String(agent ?? "").toLowerCase();
  if (raw.includes("chrome") && !raw.includes("edg")) return "Chrome";
  if (raw.includes("firefox")) return "Firefox";
  if (raw.includes("safari") && !raw.includes("chrome")) return "Safari";
  if (raw.includes("edg")) return "Edge";
  if (raw.includes("opera") || raw.includes("opr")) return "Opera";
  return "Browser";
}

function SessionSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/50 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-200/70" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 rounded-md bg-slate-200/70" />
              <div className="h-3 w-2/3 rounded-md bg-slate-200/70" />
              <div className="h-3 w-1/3 rounded-md bg-slate-200/70" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-200/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const nav = useNavigate();
  const { reloadMe, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);

  const loadProfile = useCallback(async () => {
    try {
      setLoadingProfile(true);
      const data: any = await apiFetch("/user/me", { method: "GET" });
      const nextProfile = (data?.user ?? null) as UserProfile | null;
      setProfile(nextProfile);
      setNameInput(String(nextProfile?.name ?? ""));
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat profil",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const data = (await apiFetch("/sessions", { method: "GET" })) as SessionResponse;
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
      setCurrentSessionId(String(data?.currentSessionId ?? "") || null);
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat sesi login",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadSessions();
  }, [loadProfile, loadSessions]);

  const profileNameTrimmed = nameInput.trim();
  const initialName = String(profile?.name ?? "");
  const canSaveProfile =
    profileNameTrimmed.length > 0 &&
    profileNameTrimmed.length <= 100 &&
    profileNameTrimmed !== initialName &&
    !savingProfile;

  const passwordRules = useMemo(() => toPasswordRules(newPassword), [newPassword]);
  const isStrongPassword =
    passwordRules.length &&
    passwordRules.lower &&
    passwordRules.upper &&
    passwordRules.digit &&
    passwordRules.symbol;

  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const canSavePassword =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    !passwordMismatch &&
    isStrongPassword &&
    !savingPassword;

  const activeOtherSessions = useMemo(
    () => sessions.filter((session) => session.id !== currentSessionId),
    [sessions, currentSessionId]
  );

  const totalSessionPages = useMemo(
    () => Math.max(1, Math.ceil(sessions.length / SESSIONS_PAGE_SIZE)),
    [sessions.length]
  );

  const pagedSessions = useMemo(() => {
    const start = (sessionPage - 1) * SESSIONS_PAGE_SIZE;
    return sessions.slice(start, start + SESSIONS_PAGE_SIZE);
  }, [sessions, sessionPage]);

  useEffect(() => {
    setSessionPage((prev) => Math.min(prev, totalSessionPages));
  }, [totalSessionPages]);

  const passwordStrength = useMemo(() => {
    const rules = Object.values(passwordRules);
    const passed = rules.filter(Boolean).length;
    if (passed === 0) return { pct: 0, label: "", color: "" };
    if (passed <= 2) return { pct: 30, label: "Lemah", color: "bg-rose-400" };
    if (passed <= 3) return { pct: 55, label: "Sedang", color: "bg-amber-400" };
    if (passed <= 4) return { pct: 80, label: "Kuat", color: "bg-emerald-400" };
    return { pct: 100, label: "Sangat Kuat", color: "bg-emerald-500" };
  }, [passwordRules]);

  const onSaveProfile = useCallback(async () => {
    if (!canSaveProfile) return;
    try {
      setSavingProfile(true);
      const data: any = await apiFetch("/user/me", {
        method: "PUT",
        body: JSON.stringify({ name: profileNameTrimmed }),
      });
      const nextProfile = (data?.user ?? null) as UserProfile | null;
      setProfile(nextProfile);
      setNameInput(String(nextProfile?.name ?? ""));
      await reloadMe();
      sileo.success({
        title: "Profil diperbarui",
        description: "Nama akun berhasil disimpan.",
        position: "top-center",
      });
    } catch (e: any) {
      sileo.error({
        title: "Gagal menyimpan profil",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setSavingProfile(false);
    }
  }, [canSaveProfile, profileNameTrimmed, reloadMe]);

  const onChangePassword = useCallback(async () => {
    if (!canSavePassword) return;
    try {
      setSavingPassword(true);
      await apiFetch("/user/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await loadSessions();
      sileo.success({
        title: "Password berhasil diubah",
        description: "Sesi lain sudah otomatis dikeluarkan.",
        position: "top-center",
      });
    } catch (e: any) {
      sileo.error({
        title: "Gagal mengubah password",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setSavingPassword(false);
    }
  }, [canSavePassword, currentPassword, newPassword, loadSessions]);

  const onRevokeSession = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    try {
      setRevokingId(sessionId);
      await apiFetch(`/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      sileo.success({
        title: "Sesi dicabut",
        description: "Perangkat tersebut berhasil dikeluarkan.",
        position: "top-center",
      });
    } catch (e: any) {
      sileo.error({
        title: "Gagal mencabut sesi",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setRevokingId(null);
    }
  }, []);

  const onRevokeOthers = useCallback(async () => {
    if (activeOtherSessions.length === 0) return;
    try {
      setRevokingOthers(true);
      await apiFetch("/sessions", { method: "DELETE" });
      setSessions((prev) => prev.filter((session) => session.id === currentSessionId));
      sileo.success({
        title: "Sesi lain dikeluarkan",
        description: "Hanya perangkat ini yang tetap login.",
        position: "top-center",
      });
    } catch (e: any) {
      sileo.error({
        title: "Gagal revoke sesi",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setRevokingOthers(false);
    }
  }, [activeOtherSessions.length, currentSessionId]);

  const onLogoutCurrent = useCallback(async () => {
    try {
      await logout();
      nav("/login", { replace: true });
    } catch {
      nav("/login", { replace: true });
    }
  }, [logout, nav]);

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

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
     
      <div className="grid min-w-0 gap-6 lg:grid-cols-12">
        {/* ──── LEFT COLUMN ──── */}
        <div className="min-w-0 space-y-6 lg:col-span-6">
          {/* ════════ PROFILE ════════ */}
          <Card className="!p-0 overflow-hidden border-0 shadow-sm">
            <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon
                    name="iconify:solar:user-circle-bold-duotone"
                    className="h-4.5 w-4.5 text-white"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Profil</h2>
                  <p className="text-[11px] text-slate-400">
                    Perbarui informasi dasar akun kamu
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {loadingProfile ? (
                <div className="animate-pulse space-y-4">
                  <div className="space-y-1.5">
                    <div className="h-3 w-12 rounded-md bg-slate-200/70" />
                    <div className="h-11 w-full rounded-xl bg-slate-100/80" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-12 rounded-md bg-slate-200/70" />
                    <div className="h-11 w-full rounded-xl bg-slate-100/80" />
                  </div>
                  <div className="h-16 w-full rounded-xl bg-slate-100/80" />
                </div>
              ) : (
                <>
                  <Input
                    label="Nama"
                    placeholder="Masukkan nama akun"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    leftIcon="iconify:solar:user-id-bold-duotone"
                    error={
                      nameInput.length > 100
                        ? "Nama maksimal 100 karakter."
                        : profileNameTrimmed.length === 0
                          ? "Nama wajib diisi."
                          : undefined
                    }
                  />

                  <Input
                    label="Email"
                    value={String(profile?.email ?? "")}
                    readOnly
                    leftIcon="iconify:solar:letter-bold-duotone"
                  />

                  {/* User ID + Save */}
                  <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        User ID
                      </p>
                      <button
                        onClick={() => copyText(profile?.id ?? "")}
                        className="mt-1 flex w-full min-w-0 items-center gap-1 font-mono text-xs text-slate-600 transition-colors hover:text-slate-800"
                      >
                        <span className="min-w-0 flex-1 truncate text-left">{profile?.id || "-"}</span>
                        <Icon name="iconify:solar:copy-linear" className="h-3 w-3 shrink-0 text-slate-400" />
                      </button>
                    </div>
                    <Button
                      size="sm"
                      isLoading={savingProfile}
                      disabled={!canSaveProfile}
                      onClick={onSaveProfile}
                      leftIcon="check"
                      className="!h-9 w-full !text-xs !font-bold sm:w-auto"
                    >
                      Simpan Profil
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* ════════ PASSWORD ════════ */}
          <Card className="!p-0 overflow-hidden border-0 shadow-sm">
            <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon
                    name="iconify:solar:shield-keyhole-bold-duotone"
                    className="h-4.5 w-4.5 text-white"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Keamanan Password</h2>
                  <p className="text-[11px] text-slate-400">
                    Gunakan password kuat untuk melindungi akun
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <PasswordInput
                label="Password Saat Ini"
                placeholder="Masukkan password lama"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                leftIcon="iconify:solar:lock-password-bold-duotone"
              />
              <PasswordInput
                label="Password Baru"
                placeholder="Masukkan password baru"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon="iconify:solar:lock-password-bold-duotone"
              />

              {/* Strength meter */}
              {newPassword.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Kekuatan Password
                    </span>
                    <span
                      className={cx(
                        "text-[10px] font-bold",
                        passwordStrength.pct >= 80
                          ? "text-emerald-600"
                          : passwordStrength.pct >= 55
                            ? "text-amber-600"
                            : "text-rose-600"
                      )}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cx(
                        "h-full rounded-full transition-all duration-500",
                        passwordStrength.color
                      )}
                      style={{ width: `${passwordStrength.pct}%` }}
                    />
                  </div>
                </div>
              )}

              <PasswordInput
                label="Konfirmasi Password Baru"
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon="iconify:solar:lock-password-bold-duotone"
                error={passwordMismatch ? "Konfirmasi password tidak sama." : undefined}
              />

              {/* Password rules */}
              <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-4">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Syarat password
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { ok: passwordRules.length, label: "10-72 karakter", icon: "iconify:solar:ruler-bold-duotone" },
                    { ok: passwordRules.lower, label: "Huruf kecil (a-z)", icon: "iconify:solar:text-bold-duotone" },
                    { ok: passwordRules.upper, label: "Huruf besar (A-Z)", icon: "iconify:solar:text-bold-duotone" },
                    { ok: passwordRules.digit, label: "Angka (0-9)", icon: "iconify:solar:hashtag-bold-duotone" },
                    { ok: passwordRules.symbol, label: "Simbol (!@#$)", icon: "iconify:solar:star-bold-duotone" },
                  ].map((rule) => (
                    <div
                      key={rule.label}
                      className={cx(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[11px] font-medium transition-all duration-300",
                        rule.ok
                          ? "border-emerald-200/60 bg-emerald-50/80 text-emerald-700"
                          : "border-slate-200/60 bg-white text-slate-500"
                      )}
                    >
                      <div
                        className={cx(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all duration-300",
                          rule.ok ? "bg-emerald-100" : "bg-slate-100"
                        )}
                      >
                        <Icon
                          name={rule.ok ? "check" : "x"}
                          className={cx(
                            "h-3 w-3 transition-colors",
                            rule.ok ? "text-emerald-600" : "text-slate-400"
                          )}
                        />
                      </div>
                      {rule.label}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                size="sm"
                isLoading={savingPassword}
                disabled={!canSavePassword}
                onClick={onChangePassword}
                leftIcon="iconify:solar:shield-check-bold-duotone"
                className="!h-9 w-full !text-xs !font-bold"
              >
                Ubah Password
              </Button>
            </div>
          </Card>
        </div>

        {/* ──── RIGHT COLUMN ──── */}
        <div className="min-w-0 space-y-6 lg:col-span-6">
          {/* ════════ SESSIONS ════════ */}
          <Card className="!p-0 overflow-hidden border-0 shadow-sm">
            <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                    <Icon
                      name="iconify:solar:laptop-bold-duotone"
                      className="h-4.5 w-4.5 text-white"
                    />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Perangkat Login</h2>
                    <p className="text-[11px] text-slate-400">
                      {loadingSessions
                        ? "Memuat..."
                        : `${sessions.length} sesi aktif`}
                    </p>
                  </div>
                </div>
                {activeOtherSessions.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200/60">
                    {activeOtherSessions.length} lainnya
                  </span>
                )}
              </div>
            </div>

            <div className="p-4">
              {loadingSessions ? (
                <SessionSkeleton />
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                    <Icon
                      name="iconify:solar:laptop-bold-duotone"
                      className="h-6 w-6 text-slate-300"
                    />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-500">Tidak ada sesi aktif</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pagedSessions.map((session) => {
                    const isCurrent = session.id === currentSessionId;
                    const isRevoking = revokingId === session.id;
                    const deviceIcon = detectDeviceIcon(session.userAgent);
                    const browserName = detectBrowserName(session.userAgent);

                    return (
                      <div
                        key={session.id}
                        className={cx(
                          "group rounded-xl border p-4 transition-all duration-200",
                          isCurrent
                            ? "border-emerald-300/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/30 ring-1 ring-emerald-300/20 dark:border-emerald-700/60 dark:from-emerald-950/45 dark:to-teal-950/25 dark:ring-emerald-700/30"
                            : "border-slate-200/60 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {/* Device icon */}
                          <div
                            className={cx(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm",
                              isCurrent
                                ? "border-emerald-200 bg-emerald-100/80 dark:border-emerald-700 dark:bg-emerald-900/45"
                                : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/85"
                            )}
                          >
                            <Icon
                              name={deviceIcon}
                              className={cx(
                                "h-5 w-5",
                                isCurrent ? "text-emerald-600 dark:text-emerald-300" : "text-slate-500 dark:text-slate-300"
                              )}
                            />
                          </div>

                          {/* Session info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {browserName}
                              </p>
                              {isCurrent ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-950/45 dark:text-emerald-300 dark:ring-emerald-700/65">
                                  <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse dark:bg-emerald-300" />
                                  Perangkat ini
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700/65">
                                  Aktif
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                              {userAgentLabel(session.userAgent)}
                            </p>

                            <div className="mt-2 space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <Icon
                                  name="iconify:solar:global-bold-duotone"
                                  className="h-3 w-3 text-slate-400"
                                />
                                IP: <span className="font-mono font-semibold">{session.ip || "-"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <Icon
                                  name="iconify:solar:clock-circle-bold-duotone"
                                  className="h-3 w-3 text-slate-400"
                                />
                                Login: {formatTime(session.createdAt)}
                                {relativeTime(session.createdAt) && (
                                  <span className="text-slate-400">
                                    ({relativeTime(session.createdAt)})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <Icon
                                  name="iconify:solar:alarm-bold-duotone"
                                  className="h-3 w-3 text-slate-400"
                                />
                                Expires: {formatTime(session.expiresAt)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Revoke button */}
                        {!isCurrent && (
                          <div className="mt-3 border-t border-slate-100/80 pt-3 dark:border-slate-700/70">
                            <Button
                              variant="danger"
                              size="sm"
                              isLoading={isRevoking}
                              disabled={isRevoking || revokingOthers}
                              onClick={() => onRevokeSession(session.id)}
                              leftIcon="x"
                              className="!h-8 !text-[11px] !font-bold w-full"
                            >
                              Keluarkan Perangkat
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!loadingSessions && sessions.length > SESSIONS_PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/70">
                  <span className="text-[10px] font-semibold text-slate-500">
                    Halaman {sessionPage} dari {totalSessionPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={sessionPage <= 1}
                      onClick={() => setSessionPage((prev) => Math.max(1, prev - 1))}
                      className="!h-8 !px-2.5 !text-[10px] !font-bold"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={sessionPage >= totalSessionPages}
                      onClick={() =>
                        setSessionPage((prev) => Math.min(totalSessionPages, prev + 1))
                      }
                      className="!h-8 !px-2.5 !text-[10px] !font-bold"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={revokingOthers}
                  disabled={activeOtherSessions.length === 0 || revokingOthers}
                  onClick={onRevokeOthers}
                  leftIcon="iconify:solar:shield-cross-bold-duotone"
                  className="!h-9 !text-[11px] !font-bold"
                >
                  Keluar Semua
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onLogoutCurrent}
                  leftIcon="iconify:solar:logout-2-bold-duotone"
                  className="!h-9 !text-[11px] !font-bold"
                >
                  Logout Sekarang
                </Button>
              </div>
            </div>
          </Card>

          {/* ════════ SECURITY TIP ════════ */}
          <div className="flex items-start gap-3 rounded-xl border border-teal-200/40 bg-gradient-to-r from-teal-50/80 to-emerald-50/50 p-4 dark:border-teal-700/50 dark:from-teal-950/35 dark:to-emerald-950/30">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100/80 dark:bg-teal-900/40">
              <Icon name="shield" className="h-4 w-4 text-teal-600 dark:text-teal-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-teal-800 dark:text-teal-200">Tips Keamanan</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-teal-700/80 dark:text-teal-200/85">
                Logout dari perangkat yang tidak dikenali. Ganti password secara berkala dan aktifkan
                autentikasi kuat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
