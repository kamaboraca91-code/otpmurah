// src/pages/admin/AdminLogin.tsx
import React from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { sileo } from "sileo";
import { useAdminAuth } from "../../auth/AdminAuthProvider";

import {
  Button,
  Icon,
  Input,
  PasswordInput,
} from "../../components/ui";

export default function AdminLogin() {
  const nav = useNavigate();
  const loc = useLocation();
  const { admin, isLoading, adminLogin } = useAdminAuth();
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
  const turnstileContainerRef = React.useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = React.useRef<string | null>(null);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [requireCaptcha, setRequireCaptcha] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const stateReason = (loc.state as any)?.reason;
    const params = new URLSearchParams(loc.search);
    const queryReason = params.get("reason");
    const source = params.get("source");

    if (stateReason !== "auth-required" && queryReason !== "auth-required") return;

    const isExpired = source === "expired";
    const description = isExpired
      ? "Session admin berakhir, silakan login kembali."
      : "Silakan login admin untuk mengakses halaman tersebut.";

    sileo.error({
      title: "Autentikasi dibutuhkan",
      description,
      position: "top-center",
    });
  }, [loc.state, loc.search]);

  React.useEffect(() => {
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

  const canSubmit = React.useMemo(() => {
    if (!email.trim() || !password) return false;
    if (submitting) return false;
    if (requireCaptcha) return Boolean(captchaToken);
    return true;
  }, [email, password, submitting, requireCaptcha, captchaToken]);

  if (!isLoading && admin) return <Navigate to="/admin" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requireCaptcha && !turnstileSiteKey) {
      sileo.error({
        title: "Captcha belum aktif",
        description: "Isi VITE_TURNSTILE_SITE_KEY di frontend.",
        position: "top-center",
      });
      return;
    }
    if (requireCaptcha && !captchaToken) {
      sileo.error({
        title: "Captcha wajib diisi",
        description: "Selesaikan captcha sebelum login admin.",
        position: "top-center",
      });
      return;
    }
    setSubmitting(true);

    try {
      await adminLogin(email, password, requireCaptcha ? captchaToken : undefined);
      setRequireCaptcha(false);
      resetCaptcha();
      const fromState = (loc.state as any)?.from as string | undefined;
      const fromQuery = new URLSearchParams(loc.search).get("from") ?? undefined;
      const from = fromState ?? fromQuery;
      const redirectTo = from && from.startsWith("/admin") ? from : "/admin";
      nav(redirectTo, { replace: true });
    } catch (e: any) {
      const captchaRequired =
        Boolean(e?.captchaRequired) || Boolean(e?.data?.captchaRequired);
      if (captchaRequired) {
        setRequireCaptcha(true);
        resetCaptcha();
      }
      sileo.error({
        title: "Login gagal",
        description: e?.message ?? "Cek email/password admin.",
        position: "top-center",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Background decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-[120px]" />
        <div className="absolute bottom-[-12rem] right-[-10rem] h-96 w-96 rounded-full bg-teal-100/30 blur-[100px]" />
        <div className="absolute left-[-8rem] top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-emerald-100/25 blur-[80px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8 md:px-12 lg:px-16">
        {/* ========== Top Navigation ========== */}
        <nav className="flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-sm font-extrabold text-white ">
              HS
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">HeroSMS</div>
              <div className="text-[11px] text-slate-500">Admin Portal</div>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link to="/" className="hidden sm:inline-flex">
              <Button
                variant="secondary"
                size="sm"
                leftIcon="iconify:solar:home-2-bold-duotone"
              >
                Website
              </Button>
            </Link>
            <Link to="/login" className="inline-flex">
              <Button variant="primary" size="sm" rightIcon="arrowRight">
                Login User
              </Button>
            </Link>
          </div>
        </nav>

        {/* ========== Main Content ========== */}
        <div className="mt-10 grid items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
          {/* ===== Left: Brand / Features ===== */}
          <div className="flex flex-col justify-center">
            {/* Badge */}
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-600 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-600" />
              </span>
              Enterprise Security
            </div>

            {/* Headline */}
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Admin{" "}
              <span className="bg-teal-600 bg-clip-text text-transparent">
                Control Panel
              </span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
             Login Untuk Kelola Sistem Website
            </p>
          </div>

          {/* ===== Right: Login Form ===== */}
          <div className="flex items-center">
            <div className="w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 ">
              {/* Card header */}
              <div className="border-b border-zinc-100 bg-gradient-to-r from-white to-emerald-50/30 px-6 py-5 sm:px-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 ">
                      <Icon
                        name="iconify:solar:lock-keyhole-bold-duotone"
                        className="h-5 w-5 text-white"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Masuk Admin
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        Gunakan kredensial admin
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-600 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-600" />
                    </span>
                    Ready
                  </span>
                </div>
              </div>

              {/* Form body */}
              <div className="px-6 py-6 sm:px-8 sm:py-7">
                <form onSubmit={onSubmit} className="space-y-5">
                  <Input
                    label="Email Admin"
                    placeholder="admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    leftIcon="iconify:solar:letter-bold-duotone"
                  />

                  <PasswordInput
                    label="Password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    leftIcon="iconify:solar:lock-password-bold-duotone"
                  />

                  {requireCaptcha ? (
                    <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3">
                      <p className="mb-2 text-[11px] font-semibold text-amber-700">
                        Demi keamanan, selesaikan captcha untuk login admin.
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
                    variant="primary"
                    size="md"
                    className="w-full"
                    rightIcon="arrowRight"
                    isLoading={submitting}
                    disabled={!canSubmit}
                  >
                    {submitting ? "Signing in..." : "Login Admin"}
                  </Button>
                </form>
               
              </div>

              {/* Card footer */}
              <div className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-3.5 sm:px-8">
                <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Icon
                      name="iconify:solar:shield-check-bold-duotone"
                      className="h-3 w-3"
                    />
                    <span>SSL Encrypted</span>
                  </div>
                  <span className="h-3 w-px bg-zinc-200" />
                  <div className="flex items-center gap-1">
                    <Icon
                      name="iconify:solar:lock-keyhole-bold-duotone"
                      className="h-3 w-3"
                    />
                    <span>Admin Only</span>
                  </div>
                  <span className="h-3 w-px bg-zinc-200" />
                  <div className="flex items-center gap-1">
                    <Icon
                      name="iconify:solar:check-circle-bold-duotone"
                      className="h-3 w-3"
                    />
                    <span>Verified</span>
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
