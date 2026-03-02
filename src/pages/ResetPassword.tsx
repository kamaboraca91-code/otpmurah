import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { sileo } from "sileo";

import { Button, Icon, PasswordInput } from "../components/ui";
import { apiFetch } from "../lib/api";
import {
  getDefaultWebsiteBranding,
  getWebsiteBranding,
  type WebsiteBranding,
} from "../lib/websiteBranding";

function passwordRules(pw: string) {
  return {
    len: pw.length >= 10,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    sym: /[^A-Za-z0-9]/.test(pw),
  };
}

export default function ResetPassword() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") ?? "").trim();
  const tokenPattern = /^[a-fA-F0-9]{64}$/;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenReady, setTokenReady] = useState(false);
  const [branding, setBranding] = useState<WebsiteBranding>(() => getDefaultWebsiteBranding());

  const rules = useMemo(() => passwordRules(newPassword), [newPassword]);
  const strong = rules.len && rules.lower && rules.upper && rules.digit && rules.sym;
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await getWebsiteBranding();
      if (!mounted) return;
      setBranding(data);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function validateToken() {
      if (!tokenPattern.test(token)) {
        nav("/not-found", { replace: true });
        return;
      }

      try {
        await apiFetch("/auth/password/validate-link", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        if (!active) return;
        setTokenReady(true);
      } catch (err: any) {
        if (!active) return;
        const msg = String(err?.message ?? "");
        if (/tidak ditemukan|tidak valid|validation/i.test(msg)) {
          nav("/not-found", { replace: true });
          return;
        }
        sileo.error({
          title: "Validasi link gagal",
          description: "Coba refresh halaman atau minta link reset baru.",
        });
      } finally {
        if (active) setValidatingToken(false);
      }
    }

    void validateToken();
    return () => {
      active = false;
    };
  }, [token, nav]);

  const canSubmit = useMemo(() => {
    return tokenReady && strong && !passwordMismatch && !submitting;
  }, [tokenReady, strong, passwordMismatch, submitting]);

  const brandName = branding.siteName || "OTP Seller";
  const brandDescription = branding.siteDescription || "Akun Recovery";
  const brandLogo = branding.logoUrl;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!tokenReady) {
      sileo.error({ title: "Link reset password tidak valid" });
      return;
    }
    if (!strong) {
      sileo.error({ title: "Password belum memenuhi syarat" });
      return;
    }
    if (passwordMismatch) {
      sileo.error({ title: "Konfirmasi password tidak sama" });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch("/auth/password/reset-link", {
        method: "POST",
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });
      sileo.success({
        title: "Password berhasil diubah",
        description: "Silakan login dengan password baru.",
      });
      nav("/login", { replace: true });
    } catch (err: any) {
      const msg = err?.message ?? "Gagal reset password.";
      sileo.error({ title: "Reset password gagal", description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (validatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-5 py-10 sm:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center">
          <div className="w-full rounded-3xl border border-zinc-200/80 bg-white/90 p-8 text-center shadow-xl shadow-emerald-500/[0.04] sm:p-10">
            <div className="mx-auto mb-5 flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Icon name="iconify:solar:shield-check-bold-duotone" className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Memvalidasi Link Reset</h1>
            <p className="mt-2 text-sm text-slate-500">Tunggu sebentar, kami sedang memeriksa link kamu.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-emerald-200/25 blur-[100px]" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-80 w-80 rounded-full bg-teal-100/40 blur-[80px]" />
        <div className="absolute left-[-6rem] top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-emerald-100/30 blur-[60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.06),transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-5 py-10 sm:px-8 md:px-12 lg:px-20">
        <div className="grid w-full grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-20">
          <div>
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 shadow-xl shadow-emerald-500/[0.03] backdrop-blur-xl">
              <div className="border-b border-zinc-100 bg-gradient-to-r from-white to-emerald-50/30 px-6 py-5 sm:px-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Buat Password Baru</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Password lama akan otomatis dinonaktifkan
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/80">
                    <Icon
                      name="iconify:solar:password-minimalistic-input-bold-duotone"
                      className="h-5 w-5 text-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8 sm:py-7">
               
                <form onSubmit={onSubmit} className="space-y-5">
                  <PasswordInput
                    label="Password Baru"
                    placeholder="Masukkan password baru"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    leftIcon="iconify:solar:lock-password-bold-duotone"
                    autoComplete="new-password"
                  />

                  <PasswordInput
                    label="Konfirmasi Password Baru"
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon="iconify:solar:lock-password-bold-duotone"
                    autoComplete="new-password"
                    error={
                      passwordMismatch ? "Konfirmasi password tidak sama." : undefined
                    }
                  />

                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200/80 bg-white p-3 sm:grid-cols-3">
                    <Req ok={rules.len} text=">= 10 karakter" />
                    <Req ok={rules.lower} text="Huruf kecil" />
                    <Req ok={rules.upper} text="Huruf besar" />
                    <Req ok={rules.digit} text="Angka" />
                    <Req ok={rules.sym} text="Simbol" />
                    <Req ok={strong} text="Semua ok" highlight />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={submitting}
                    disabled={!canSubmit}
                    rightIcon="arrowRight"
                  >
                    Simpan Password Baru
                  </Button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200/80" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-zinc-400">kembali</span>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200/60 bg-zinc-50/50 px-4 py-3.5 text-center">
                  <p className="text-sm text-slate-600">
                    Kembali ke{" "}
                    <Link
                      to="/login"
                      className="font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
                    >
                      halaman login
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Security Recovery
            </div>

            <div className="mt-6 flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm shadow-emerald-500/10">
                {brandLogo ? (
                  <img
                    src={brandLogo}
                    alt={brandName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Icon name="shield" className="h-6 w-6 text-emerald-600" />
                )}
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">{brandName}</div>
                <div className="text-xs text-slate-500">{brandDescription}</div>
              </div>
            </div>

            <h1 className="mt-7 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Set password baru{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                dengan aman
              </span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
              Setelah berhasil, semua sesi login lama akan keluar otomatis demi keamanan akun.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Req({
  ok,
  text,
  highlight,
}: {
  ok: boolean;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-all duration-200",
        ok
          ? highlight
            ? "border-emerald-200 bg-emerald-50"
            : "border-emerald-200/60 bg-emerald-50/50"
          : "border-zinc-200/80 bg-white",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200",
          ok
            ? "border-emerald-300 bg-emerald-100 text-emerald-600"
            : "border-zinc-200 bg-zinc-50 text-zinc-400",
        ].join(" ")}
      >
        <Icon name={ok ? "check" : "x"} className="h-3 w-3" />
      </span>
      <span
        className={[
          "text-xs font-medium transition-colors duration-200",
          ok ? "text-emerald-700" : "text-slate-500",
        ].join(" ")}
      >
        {text}
      </span>
    </div>
  );
}
