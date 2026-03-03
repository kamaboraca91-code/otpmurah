import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sileo } from "sileo";

import {
  Button,
  Icon,
  Input,
  PasswordInput,
} from "../components/ui";
import { useAuth } from "../auth/useAuth";
import { apiFetch } from "../lib/api";
import {
  getDefaultWebsiteBranding,
  getWebsiteBranding,
  type WebsiteBranding,
} from "../lib/websiteBranding";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function passwordRules(pw: string) {
  return {
    len: pw.length >= 10,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    sym: /[^A-Za-z0-9]/.test(pw),
  };
}

function parseWaitSeconds(message: string) {
  const match = String(message ?? "").match(/Tunggu\s+(\d+)\s+detik/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cooldownStorageKey(email: string) {
  return `register-code-cooldown:${email}`;
}

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeSentForEmail, setCodeSentForEmail] = useState("");
  const [resendInSec, setResendInSec] = useState(0);

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

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailError =
    email.length > 0 && !isValidEmail(emailNorm)
      ? "Format email tidak valid."
      : undefined;

  const rules = useMemo(() => passwordRules(password), [password]);
  const strong =
    rules.len && rules.lower && rules.upper && rules.digit && rules.sym;

  const canSubmit = useMemo(() => {
    return (
      name.trim().length >= 1 &&
      isValidEmail(emailNorm) &&
      codeSent &&
      codeSentForEmail === emailNorm &&
      verificationCode.length === 6 &&
      strong &&
      !submitting
    );
  }, [name, emailNorm, codeSent, codeSentForEmail, verificationCode, strong, submitting]);

  const canSendCode = useMemo(() => {
    return (
      isValidEmail(emailNorm) &&
      !sendingCode &&
      resendInSec === 0 &&
      Boolean(captchaToken)
    );
  }, [emailNorm, sendingCode, resendInSec, captchaToken]);

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

  useEffect(() => {
    if (!codeSent) return;
    if (codeSentForEmail === emailNorm) return;
    setCodeSent(false);
    setVerificationCode("");
  }, [codeSent, codeSentForEmail, emailNorm]);

  async function onSendVerificationCode() {
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
      setSendingCode(true);
      const out = await apiFetch("/auth/register/request-code", {
        method: "POST",
        timeoutMs: 15000,
        body: JSON.stringify({ email: emailNorm, captchaToken }),
      });

      setCodeSent(true);
      setCodeSentForEmail(emailNorm);
      setVerificationCode("");
      const nextResendIn = Number(out?.resendInSec ?? 60);
      setResendInSec(nextResendIn);
      window.localStorage.setItem(
        cooldownStorageKey(emailNorm),
        String(Date.now() + nextResendIn * 1000),
      );
      sileo.success({
        title: "Kode verifikasi terkirim",
        description: `Kode telah dikirim ke ${emailNorm}`,
      });
      resetCaptcha();
    } catch (err: any) {
      const msg = err?.message ?? "Gagal mengirim kode verifikasi.";
      const waitSec = parseWaitSeconds(msg);
      if (waitSec && isValidEmail(emailNorm)) {
        setResendInSec(waitSec);
        window.localStorage.setItem(
          cooldownStorageKey(emailNorm),
          String(Date.now() + waitSec * 1000),
        );
      }
      sileo.error({ title: "Gagal kirim kode", description: msg });
      resetCaptcha();
    } finally {
      setSendingCode(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      sileo.error({ title: "Nama wajib diisi" });
      return;
    }
    if (!isValidEmail(emailNorm)) {
      sileo.error({ title: "Email tidak valid" });
      return;
    }
    if (!strong) {
      sileo.error({ title: "Password belum memenuhi syarat" });
      return;
    }
    if (verificationCode.length !== 6) {
      sileo.error({ title: "Kode verifikasi belum valid" });
      return;
    }

    try {
      setSubmitting(true);
      await register(emailNorm, password, name.trim(), verificationCode);
      sileo.success({ title: "Akun berhasil dibuat" });
      nav("/login", { replace: true });
    } catch (err: any) {
      const msg = err?.message ?? "Register gagal. Coba lagi.";
      sileo.error({ title: "Register gagal", description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    {
      num: "1",
      title: "Isi Data Diri",
      desc: "Nama, email, dan password.",
      active: !codeSent,
    },
    {
      num: "2",
      title: "Verifikasi Email",
      desc: "Cek inbox untuk konfirmasi.",
      active: codeSent && verificationCode.length < 6,
    },
    {
      num: "3",
      title: "Mulai Belanja",
      desc: "Beli virtual number favorit.",
      active: verificationCode.length === 6,
    },
  ];

  const brandName = branding.siteName || "OTP Seller";
  const brandDescription = branding.siteDescription || "Virtual Number Provider";
  const brandLogo = branding.logoUrl;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Background decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 right-1/3 h-96 w-96 rounded-full bg-emerald-200/25 blur-[100px]" />
        <div className="absolute bottom-[-10rem] left-[-8rem] h-80 w-80 rounded-full bg-teal-100/40 blur-[80px]" />
        <div className="absolute right-[-6rem] top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-emerald-100/30 blur-[60px]" />
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
          {/* ========== Left: Form Card ========== */}
          <div className="order-1">
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 shadow-xl shadow-emerald-500/[0.03] backdrop-blur-xl">
              {/* Card header */}
              <div className="border-b border-zinc-100 bg-gradient-to-r from-white to-emerald-50/30 px-6 py-5 sm:px-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Buat Akun Baru
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Daftar dalam hitungan detik
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/80">
                    <Icon
                      name="iconify:solar:user-plus-bold-duotone"
                      className="h-5 w-5 text-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Form body */}
              <div className="px-6 py-6 sm:px-8 sm:py-7">
             
                <form onSubmit={onSubmit} className="space-y-5">
                  <Input
                    label="Nama Lengkap"
                    placeholder="Nama kamu"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    leftIcon="iconify:solar:user-id-bold-duotone"
                  />

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

                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3">
                    
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <Input
                          label="Kode Verifikasi Email"
                          placeholder="6 digit kode"
                          value={verificationCode}
                          onChange={(e) =>
                            setVerificationCode(
                              e.target.value.replace(/\D+/g, "").slice(0, 6),
                            )
                          }
                          leftIcon="iconify:solar:shield-keyhole-bold-duotone"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={onSendVerificationCode}
                        disabled={!canSendCode}
                        isLoading={sendingCode}
                        className="sm:!h-11 sm:min-w-[170px]"
                      >
                        {sendingCode
                          ? "Mengirim..."
                          : resendInSec > 0
                          ? `Kirim Ulang (${resendInSec}s)`
                          : codeSent
                            ? "Kirim Ulang Kode"
                            : "Kirim Kode"}
                      </Button>
                    </div>
                    <div className="mb-2 mt-2 flex justify-center items-center">
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
                    <p className="mt-2 text-[11px] text-slate-500">
                      Kode verifikasi berlaku 10 menit. Cek inbox atau folder spam.
                    </p>
                    {turnstileSiteKey && !captchaToken ? (
                      <p className="mt-1 text-[11px] text-amber-600">
                        Selesaikan captcha sebelum kirim kode.
                      </p>
                    ) : null}
                  </div>

                  <PasswordInput
                    label="Password"
                    placeholder="Buat password kuat"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon="iconify:solar:lock-password-bold-duotone"
                    autoComplete="new-password"
                  />

                  {/* Password policy */}
                  <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50/50 to-white">
                    <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Password Policy
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Pastikan semua syarat terpenuhi
                        </p>
                      </div>
                      <div
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-300",
                          strong
                            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                            : "border-zinc-200 bg-zinc-50 text-zinc-400",
                        ].join(" ")}
                      >
                        <Icon
                          name={strong ? "check" : "warning"}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                      <Req ok={rules.len} text="≥ 10 karakter" />
                      <Req ok={rules.lower} text="Huruf kecil" />
                      <Req ok={rules.upper} text="Huruf besar" />
                      <Req ok={rules.digit} text="Angka" />
                      <Req ok={rules.sym} text="Simbol" />
                      <Req ok={strong} text="Semua ✓" highlight />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={submitting}
                    disabled={!canSubmit}
                    rightIcon="arrowRight"
                  >
                    Buat Akun Sekarang
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200/80" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-zinc-400">
                      sudah punya akun?
                    </span>
                  </div>
                </div>

                {/* Login link */}
                <div className="rounded-xl border border-zinc-200/60 bg-zinc-50/50 px-4 py-3.5 text-center">
                  <p className="text-sm text-slate-600">
                    Langsung saja{" "}
                    <Link
                      to="/login"
                      className="font-bold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
                    >
                      Login di sini
                    </Link>
                  </p>
                </div>
              </div>

              {/* Card footer */}
              <div className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-3.5 sm:px-8">
                <p className="text-center text-[11px] text-zinc-400">
                  Dengan mendaftar, kamu setuju pada{" "}
                  <button
                    type="button"
                    className="font-semibold text-zinc-500 hover:text-emerald-600 hover:underline"
                  >
                    Kebijakan Privasi
                  </button>{" "}
                  &{" "}
                  <button
                    type="button"
                    className="font-semibold text-zinc-500 hover:text-emerald-600 hover:underline"
                  >
                    Ketentuan Layanan
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* ========== Right: Brand / Info ========== */}
          <div className="order-2">
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Registrasi Terbuka
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
                  <Icon name="sparkles" className="h-6 w-6 text-emerald-600" />
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
              Mulai perjalananmu{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                bersama kami
              </span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
              Buat akun dan dapatkan akses ke ribuan virtual number dari seluruh
              dunia. Proses cepat, harga terjangkau.
            </p>

            {/* Steps */}
            <div className="mt-8 space-y-3">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className={[
                    "group flex items-start gap-3.5 rounded-xl border px-4 py-3.5 backdrop-blur-sm transition-all duration-200",
                    step.active
                      ? "border-emerald-200/80 bg-emerald-50/50 shadow-sm shadow-emerald-500/5"
                      : "border-zinc-200/60 bg-white/60 hover:border-zinc-300/80 hover:shadow-sm",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors",
                      step.active
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                        : "bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200/80",
                    ].join(" ")}
                  >
                    {step.num}
                  </div>
                  <div>
                    <p
                      className={[
                        "text-sm font-semibold",
                        step.active ? "text-emerald-800" : "text-slate-700",
                      ].join(" ")}
                    >
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
                  </div>
                  {step.active && (
                    <div className="ml-auto flex items-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Aktif
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { value: "200+", label: "Negara" },
                { value: "24/7", label: "Support" },
                { value: "99.9%", label: "Uptime" },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-200/60 bg-white/60 px-3 py-3 text-center backdrop-blur-sm"
                >
                  <p className="text-lg font-bold text-emerald-600">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
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
