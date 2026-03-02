import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { sileo } from "sileo";

import {
  Button,
  Icon,
  Input,
  PasswordInput,
} from "../components/ui";
import { useAuth } from "../auth/useAuth";
import {
  getDefaultWebsiteBranding,
  getWebsiteBranding,
  type WebsiteBranding,
} from "../lib/websiteBranding";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login } = useAuth();
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [branding, setBranding] = useState<WebsiteBranding>(() => getDefaultWebsiteBranding());

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

  React.useEffect(() => {
    const stateReason = (loc.state as any)?.reason;
    const params = new URLSearchParams(loc.search);
    const queryReason = params.get("reason");
    const source = params.get("source");

    if (stateReason !== "auth-required" && queryReason !== "auth-required") return;

    const isExpired = source === "expired";
    const description = isExpired
      ? "Session kamu sudah berakhir, silakan login kembali."
      : "Silakan login untuk mengakses halaman tersebut.";

  
    sileo.info({
      title: "Autentikasi dibutuhkan",
      description,
      position: "top-center",
    });
  }, [loc.state, loc.search]);

  useEffect(() => {
    if (!requireCaptcha || !turnstileSiteKey) return;

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
  }, [requireCaptcha, turnstileSiteKey]);

  function resetCaptcha() {
    if (window.turnstile && turnstileWidgetIdRef.current) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
    setCaptchaToken("");
  }

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailError =
    email.length > 0 && !isValidEmail(emailNorm)
      ? "Format email tidak valid."
      : undefined;

  const canSubmit = useMemo(() => {
    if (requireCaptcha) {
      return (
        isValidEmail(emailNorm) &&
        password.length > 0 &&
        Boolean(captchaToken) &&
        !submitting
      );
    }
    return isValidEmail(emailNorm) && password.length > 0 && !submitting;
  }, [emailNorm, password, captchaToken, requireCaptcha, submitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
   
    if (!isValidEmail(emailNorm)) {
      
      sileo.error({ title: "Email tidak valid" });
      return;
    }
    if (!password) {
    
      sileo.error({ title: "Password wajib diisi" });
      return;
    }
    if (requireCaptcha && !turnstileSiteKey) {
      sileo.error({ title: "Captcha belum aktif" });
      return;
    }
    if (requireCaptcha && !captchaToken) {
      sileo.error({ title: "Selesaikan captcha terlebih dahulu" });
      return;
    }

    try {
      setSubmitting(true);
      await login(emailNorm, password, requireCaptcha ? captchaToken : undefined);
      setRequireCaptcha(false);
      resetCaptcha();
      sileo.success({ title: "Login berhasil" });
      const fromState = (loc.state as any)?.from as string | undefined;
      const fromQuery = new URLSearchParams(loc.search).get("from") ?? undefined;
      const from = fromState ?? fromQuery;
      const redirectTo = from && from.startsWith("/") ? from : "/";
      nav(redirectTo, { replace: true });
    } catch (err: any) {
      const captchaRequired =
        Boolean(err?.captchaRequired) || Boolean(err?.data?.captchaRequired);
      if (captchaRequired) {
        setRequireCaptcha(true);
        resetCaptcha();
      }
      const msg = err?.message ?? "Login gagal. Coba lagi.";
      sileo.error({ title: "Login gagal", description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const features = [
    {
      icon: "solar:shield-bold-duotone",
      title: "Keamanan Terjamin",
      desc: "Data dan transaksi dilindungi enkripsi.",
    },
    {
      icon: "mage:zap-square-fill",
      title: "OTP Instan",
      desc: "Terima kode verifikasi dalam hitungan detik.",
    },
    {
      icon: "oi:globe",
      title: "200+ Negara",
      desc: "Virtual number dari seluruh dunia.",
    },
  ];

  const brandName = branding.siteName || "OTP Seller";
  const brandDescription = branding.siteDescription || "Virtual Number Provider";
  const brandLogo = branding.logoUrl;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Background decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-emerald-200/25 blur-[100px]" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-80 w-80 rounded-full bg-teal-100/40 blur-[80px]" />
        <div className="absolute left-[-6rem] top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-emerald-100/30 blur-[60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.06),transparent_60%)]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-5 py-10 sm:px-8 md:px-12 lg:px-20">
        <div className="grid w-full grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-20">
          {/* ========== Left: Brand / Value ========== */}
          <div className="order-2 md:order-1">
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Platfrom Virtual Numer #1 Indonesia
            </div>

            {/* Logo + brand */}
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
                <div className="text-base font-bold text-slate-900">
                  {brandName}
                </div>
                <div className="text-xs text-slate-500">
                  {brandDescription}
                </div>
              </div>
            </div>

            {/* Headline */}
            <h1 className="mt-7 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Masuk dan lanjutkan{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                pembelianmu
              </span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
              Beli virtual number dari 200+ negara dan terima kode OTP secara
              instan. Proses cepat, aman, dan terpercaya.
            </p>

            {/* Feature cards */}
            <div className="mt-8 space-y-3">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-3.5 rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3.5 backdrop-blur-sm transition-all duration-200 hover:border-emerald-200/80 hover:bg-emerald-50/30 hover:shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-600 transition-colors group-hover:bg-emerald-100">
                  <Icon name={`iconify:${f.icon}`} className="h-5 w-5" />

                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {f.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trust indicators */}
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-emerald-100 to-teal-100 text-[10px] font-bold text-emerald-700 shadow-sm"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">2,400+</span>{" "}
                pengguna aktif
              </div>
            </div>
          </div>

          {/* ========== Right: Form Card ========== */}
          <div className="order-1 md:order-2">
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 shadow-xl shadow-emerald-500/[0.03] backdrop-blur-xl">
              {/* Card header */}
              <div className="border-b border-zinc-100 bg-gradient-to-r from-white to-emerald-50/30 px-6 py-5 sm:px-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Selamat Datang
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Masukkan kredensial untuk melanjutkan
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/80">
                    <Icon
                      name="iconify:solar:login-3-bold-duotone"
                      className="h-5 w-5 text-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Form body */}
              <div className="px-6 py-6 sm:px-8 sm:py-7">
                <form onSubmit={onSubmit} className="space-y-5">
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

                  <div>
                    <PasswordInput
                      label="Password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      leftIcon="iconify:solar:lock-password-bold-duotone"
                      autoComplete="current-password"
                    />
                    <div className="mt-2 flex justify-end">
                      <Link
                        to="/forgot-password"
                        className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
                      >
                        Lupa password?
                      </Link>
                    </div>
                  </div>

                  {requireCaptcha ? (
                    <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3">
                      <p className="mb-2 text-[11px] font-semibold text-amber-700">
                        Demi keamanan, selesaikan captcha untuk login kembali.
                      </p>
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
                  ) : null}

                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={submitting}
                    disabled={!canSubmit}
                    rightIcon="arrowRight"
                  >
                    Masuk ke Akun
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200/80" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-zinc-400">
                      atau
                    </span>
                  </div>
                </div>

                {/* Register link */}
                <div className="rounded-xl border border-zinc-200/60 bg-zinc-50/50 px-4 py-3.5 text-center">
                  <p className="text-sm text-slate-600">
                    Belum punya akun?{" "}
                    <Link
                      to="/register"
                      className="font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
                    >
                      Daftar Sekarang
                    </Link>
                  </p>
                </div>
              </div>

              {/* Card footer */}
              <div className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-3.5 sm:px-8">
                <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Icon name="shield" className="h-3 w-3" />
                    <span>SSL Encrypted</span>
                  </div>
                  <span className="h-3 w-px bg-zinc-200" />
                  <div className="flex items-center gap-1">
                    <Icon name="iconify:tdesign:secured-filled" className="h-3 w-3" />
                    <span>Secure Auth</span>
                  </div>
                  <span className="h-3 w-px bg-zinc-200" />
                  <div className="flex items-center gap-1">
                    <Icon name="iconify:token:trust" className="h-3 w-3" />
                    <span>Trusted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
