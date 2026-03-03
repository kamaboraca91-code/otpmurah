import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { sileo } from "sileo";

import { Button, Icon, Input } from "../components/ui";
import { apiFetch } from "../lib/api";
import {
  getDefaultWebsiteBranding,
  getWebsiteBranding,
  type WebsiteBranding,
} from "../lib/websiteBranding";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseWaitSeconds(message: string) {
  const match = String(message ?? "").match(/Tunggu\s+(\d+)\s+detik/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cooldownStorageKey(email: string) {
  return `password-reset-link-cooldown:${email}`;
}

export default function ForgotPassword() {
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [sending, setSending] = useState(false);
  const [resendInSec, setResendInSec] = useState(0);
  const [branding, setBranding] = useState<WebsiteBranding>(() => getDefaultWebsiteBranding());

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailError =
    email.length > 0 && !isValidEmail(emailNorm)
      ? "Format email tidak valid."
      : undefined;

  const canSend = useMemo(() => {
    return (
      isValidEmail(emailNorm) &&
      resendInSec === 0 &&
      !sending &&
      Boolean(captchaToken)
    );
  }, [emailNorm, resendInSec, sending, captchaToken]);

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
    if (!turnstileSiteKey) return;

    let cancelled = false;
    let scriptRef: HTMLScriptElement | null = document.querySelector(
      "script[data-cf-turnstile='true']",
    );

    const renderWidget = () => {
      if (cancelled) return;
      const api = window.turnstile;
      const container = turnstileContainerRef.current;
      if (!api || !container || turnstileWidgetIdRef.current) return;

      turnstileWidgetIdRef.current = api.render(container, {
        sitekey: turnstileSiteKey,
        theme: "auto",
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      if (!scriptRef) {
        scriptRef = document.createElement("script");
        scriptRef.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        scriptRef.async = true;
        scriptRef.defer = true;
        scriptRef.setAttribute("data-cf-turnstile", "true");
        document.head.appendChild(scriptRef);
      }

      const onLoad = () => renderWidget();
      scriptRef.addEventListener("load", onLoad);

      return () => {
        cancelled = true;
        scriptRef?.removeEventListener("load", onLoad);
        if (window.turnstile && turnstileWidgetIdRef.current) {
          window.turnstile.remove(turnstileWidgetIdRef.current);
          turnstileWidgetIdRef.current = null;
        }
      };
    }

    return () => {
      cancelled = true;
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileSiteKey]);

  function resetCaptcha() {
    if (window.turnstile && turnstileWidgetIdRef.current) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
    setCaptchaToken("");
  }

  useEffect(() => {
    if (!isValidEmail(emailNorm)) {
      setResendInSec(0);
      return;
    }

    const raw = window.localStorage.getItem(cooldownStorageKey(emailNorm));
    if (!raw) {
      setResendInSec(0);
      return;
    }

    const nextTs = Number(raw);
    if (!Number.isFinite(nextTs)) {
      window.localStorage.removeItem(cooldownStorageKey(emailNorm));
      setResendInSec(0);
      return;
    }

    const leftSec = Math.ceil((nextTs - Date.now()) / 1000);
    if (leftSec > 0) {
      setResendInSec(leftSec);
      return;
    }

    window.localStorage.removeItem(cooldownStorageKey(emailNorm));
    setResendInSec(0);
  }, [emailNorm]);

  useEffect(() => {
    if (resendInSec <= 0) return;
    const timer = window.setInterval(() => {
      setResendInSec((prev) => {
        const next = prev <= 1 ? 0 : prev - 1;
        if (isValidEmail(emailNorm)) {
          if (next > 0) {
            window.localStorage.setItem(
              cooldownStorageKey(emailNorm),
              String(Date.now() + next * 1000),
            );
          } else {
            window.localStorage.removeItem(cooldownStorageKey(emailNorm));
          }
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendInSec, emailNorm]);

  async function onSendResetLink() {
    if (!turnstileSiteKey) {
      sileo.error({ title: "Captcha belum aktif" });
      return;
    }
    if (!captchaToken) {
      sileo.error({ title: "Captcha wajib diisi" });
      return;
    }
    if (!isValidEmail(emailNorm)) {
      sileo.error({ title: "Email tidak valid" });
      return;
    }

    try {
      setSending(true);
      const out = await apiFetch("/auth/password/request-link", {
        method: "POST",
        timeoutMs: 15000,
        body: JSON.stringify({ email: emailNorm, captchaToken }),
      });

      const nextResendIn = Number(out?.resendInSec ?? 60);
      setResendInSec(nextResendIn);
      window.localStorage.setItem(
        cooldownStorageKey(emailNorm),
        String(Date.now() + nextResendIn * 1000),
      );
      const okMsg =
        "Jika email terdaftar, link reset password sudah dikirim. Cek inbox/spam.";
      sileo.success({ title: "Permintaan diterima", description: okMsg });
      resetCaptcha();
    } catch (err: any) {
      const msg = err?.message ?? "Gagal mengirim link reset password.";
      const waitSec = parseWaitSeconds(msg);
      if (waitSec && isValidEmail(emailNorm)) {
        setResendInSec(waitSec);
        window.localStorage.setItem(
          cooldownStorageKey(emailNorm),
          String(Date.now() + waitSec * 1000),
        );
      }
      sileo.error({ title: "Gagal kirim link", description: msg });
      resetCaptcha();
    } finally {
      setSending(false);
    }
  }

  const brandName = branding.siteName || "OTP Seller";
  const brandDescription = branding.siteDescription || "Akun Recovery";
  const brandLogo = branding.logoUrl;

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
                    <h2 className="text-xl font-bold text-slate-900">Lupa Password</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Masukkan email, kami kirim link reset password
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/80">
                    <Icon
                      name="iconify:solar:key-minimalistic-2-bold-duotone"
                      className="h-5 w-5 text-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8 sm:py-7">
                
                <div className="space-y-5">
                  <Input
                    label="Email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon="iconify:solar:letter-bold-duotone"
                    error={emailError}
                    autoComplete="email"
                    inputMode="email"
                  />

                  <div className="mb-2 mt-1 flex items-center justify-center">
                    {turnstileSiteKey ? (
                      <div
                        ref={turnstileContainerRef}
                        className="min-h-[70px] overflow-hidden"
                      />
                    ) : (
                      <p className="text-xs text-rose-600">
                        Captcha belum dikonfigurasi. Isi `VITE_TURNSTILE_SITE_KEY` di `.env`.
                      </p>
                    )}
                  </div>
                  <span className="mt-2 text-[11px] text-slate-500">
                    Link berlaku 10 menit. Demi keamanan, request dibatasi dari server.
                  </span>
                  <br />
                  {turnstileSiteKey && !captchaToken ? (
                    <span className="text-[11px] text-amber-600">
                      Selesaikan captcha sebelum kirim link.
                    </span>
                  ) : null}
                  <br />
                  <Button
                    type="button"
                    className="w-full mt-3"
                    onClick={onSendResetLink}
                    isLoading={sending}
                    disabled={!canSend}
                    rightIcon="arrowRight"
                  >
                    {sending
                      ? "Mengirim link..."
                      : resendInSec > 0
                        ? `Kirim Ulang (${resendInSec}s)`
                        : "Kirim Link Reset Password"}
                  </Button>
                </div>

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
                    Sudah ingat password?{" "}
                    <Link
                      to="/login"
                      className="font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
                    >
                      Login di sini
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
              Keamanan Akun
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
              Pulihkan akses{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                akun kamu
              </span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
              Cukup masukkan email, lalu klik link yang kami kirim untuk membuat password baru.
            </p>

            <div className="mt-8 space-y-3">
              <StepCard num="1" title="Masukkan Email" desc="Gunakan email akun terdaftar." />
              <StepCard num="2" title="Buka Link Email" desc="Klik link reset dari inbox/spam." />
              <StepCard num="3" title="Set Password Baru" desc="Setelah sukses, login kembali." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3.5 backdrop-blur-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-500">
        {num}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
