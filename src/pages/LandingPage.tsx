import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Icon, Input } from "../components/ui";
import { Icon as IconifyIcon } from "@iconify/react";
import { Link } from "react-router-dom";
import ThemeToggleButton from "../components/ThemeToggleButton";
import {
  getDefaultWebsiteBranding,
  getWebsiteBranding,
  type WebsiteBranding,
} from "../lib/websiteBranding";

type NavItem = { label: string; href: string };

const navItems: NavItem[] = [
  { label: "Produk", href: "#product" },
  { label: "Cara kerja", href: "#how" },
  { label: "FAQ", href: "#faq" },
];

const phoneHeroImg =
  "https://hero-sms.com/_ipx/q_70&s_455x651/img/phone-title.webp";

function cx(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    el!.setAttribute(key, value);
  });
}

function upsertLink(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    el!.setAttribute(key, value);
  });
}

/* â”€â”€â”€ Intersection Observer hook for scroll animations â”€â”€â”€ */
function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isInView };
}

/* â”€â”€â”€ Animated wrapper â”€â”€â”€ */
function FadeIn({
  children,
  delay = 0,
  direction = "up",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
}) {
  const { ref, isInView } = useInView();

  const translateMap = {
    up: "translate-y-8",
    down: "-translate-y-8",
    left: "translate-x-8",
    right: "-translate-x-8",
    none: "",
  };

  return (
    <div
      ref={ref}
      className={cx(
        "transition-all duration-700 ease-out",
        isInView ? "opacity-100 translate-x-0 translate-y-0" : cx("opacity-0", translateMap[direction]),
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* â”€â”€â”€ Animated counter â”€â”€â”€ */
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const { ref, isInView } = useInView();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame: number;
    const duration = 1500;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* â”€â”€â”€ Floating particles (decorative) â”€â”€â”€ */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-emerald-400/10 animate-float"
          style={{
            width: `${20 + i * 15}px`,
            height: `${20 + i * 15}px`,
            left: `${10 + i * 15}%`,
            top: `${20 + i * 10}%`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${6 + i * 2}s`,
          }}
        />
      ))}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  HEADER                                                            */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function Header({ branding }: { branding: WebsiteBranding }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const siteName = branding.siteName || "OTP Seller";
  const siteDescription = branding.siteDescription || "Nomor Virtual - Terima OTP";
  const logoUrl = branding.logoUrl;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-[60] border-b transition-all duration-300",
          isScrolled
            ? "border-slate-200/70 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/80"
            : "border-transparent bg-gradient-to-b from-white/95 via-white/90 to-white/70 backdrop-blur-xl dark:from-slate-950/95 dark:via-slate-950/90 dark:to-slate-950/75"
        )}
      >
        <Container>
          <div className="flex h-16 items-center justify-between">
            <a href="#top" className="group flex min-w-0 items-center gap-3">
              {logoUrl ? (
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <img src={logoUrl} alt={siteName} className="h-full w-full object-cover" loading="lazy" />
                </span>
              ) : (
                <span
                  className={cx(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300",
                    isScrolled
                      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-slate-200/80 bg-white/80 text-emerald-700 group-hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-emerald-300 dark:group-hover:bg-slate-900"
                  )}
                >
                  <Icon name="bolt" className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[15px] font-extrabold tracking-wide text-slate-900 dark:text-slate-100">
                  {siteName}
                </div>
                <div className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {siteDescription}
                </div>
              </div>
            </a>

            <nav className="hidden items-center gap-1.5 lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200",
                    isScrolled
                      ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      : "text-slate-700 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  )}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggleButton size="md" className="shrink-0" />

              <Link to="/login">
                <Button leftIcon="iconify:solar:login-3-bold-duotone" variant="secondary" size="sm">
                  Masuk
                </Button>
              </Link>
              <Link to="/register">
                <Button leftIcon="arrowRight" size="sm">
                  Terima SMS
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggleButton size="md" className="shrink-0" />

              <button
                type="button"
                aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
                onClick={() => setMobileOpen((v) => !v)}
                className={cx(
                  "inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-200",
                  "border-slate-200/90 bg-white/90 text-slate-700 hover:bg-white",
                  "dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900"
                )}
              >
                {mobileOpen ? (
                  <Icon name="iconify:material-symbols:close-rounded" className="h-5 w-5" />
                ) : (
                  <Icon name="iconify:material-symbols:menu-rounded" className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </Container>
      </header>

      <div
        className={cx(
          "fixed inset-x-0 top-16 z-50 transform-gpu transition-[opacity,transform] duration-300 ease-out lg:hidden",
          mobileOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0"
        )}
      >
        <div className="border-b border-slate-200/80 bg-white/95 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
          <Container className="py-3">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/70"
                >
                  {item.label}
                  <Icon name="arrowRight" className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </a>
              ))}
            </nav>

            <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="w-full">
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  Masuk
                </Link>
              </Button>
              <Button
                size="sm"
                rightIcon="arrowRight"
                className="w-full"
                onClick={() => {
                  setMobileOpen(false);
                  document.getElementById("product")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Terima SMS
              </Button>
            </div>
          </Container>
        </div>
      </div>

      <button
        type="button"
        aria-label="Tutup menu"
        onClick={() => setMobileOpen(false)}
        className={cx(
          "fixed inset-0 top-16 z-40 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <div className="h-16" />
    </>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  SECTION TITLE                                                     */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function SectionTitle({
  eyebrow,
  title,
  subtitle,
  center,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <FadeIn className={cx("max-w-3xl", center && "mx-auto text-center")}>
      {eyebrow && (
        <div
          className={cx(
            "mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-1.5 text-xs font-bold text-emerald-800 shadow-sm",
            center && "mx-auto"
          )}
        >
          <Icon name="sparkles" className="h-3.5 w-3.5" />
          {eyebrow}
        </div>
      )}
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-slate-500 sm:text-lg">{subtitle}</p>
      )}
    </FadeIn>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  HERO                                                              */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function Hero({ content }: { content: WebsiteBranding["landingContent"] }) {
  return (
    <div id="top" className="relative overflow-hidden bg-white dark:bg-slate-950">
      {/* Decorative background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-100/70 via-teal-50/50 to-cyan-100/30 blur-3xl dark:from-cyan-500/12 dark:via-emerald-500/8 dark:to-indigo-500/10" />
        <div className="absolute -bottom-40 left-1/4 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-slate-100/60 blur-3xl dark:bg-slate-900/80" />
        <div className="absolute top-1/4 right-0 h-[300px] w-[400px] rounded-full bg-emerald-50/40 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/80 dark:to-slate-950/90" />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage:
              "radial-gradient(ellipse at 40% 30%, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 40% 30%, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 70%)",
          }}
        />
        <FloatingParticles />
      </div>

      <Container>
        <div className="relative grid items-center gap-12 py-16 lg:grid-cols-12 lg:py-24">
          {/* Left content */}
          <div className="lg:col-span-7">
            <FadeIn delay={0}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {content.heroBadge}
                </span>
                <Badge tone="slate">180+ negara</Badge>
                <Badge tone="slate">700+ layanan</Badge>
              </div>
            </FadeIn>

            <FadeIn delay={100}>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.1]">
                {content.heroTitle}
                <br />
                <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  {content.heroHighlight}
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={200}>
              <p className="mt-5 max-w-xl text-base text-slate-500 sm:text-lg leading-relaxed">
                {content.heroDescription}
              </p>
            </FadeIn>

            <FadeIn delay={300}>
              <div className="mt-8 flex gap-3 sm:flex-row sm:items-center">
                <Link to="/register">
                  <Button size="sm">
                    {content.heroPrimaryCta}
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {content.heroSecondaryCta}
                </Button>
              </div>
            </FadeIn>

            {/* Stats */}
            <FadeIn delay={400}>
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Negara", value: 180, suffix: "+" },
                  { label: "Layanan", value: 700, suffix: "+" },
                  { label: "Waktu aktif", value: 99, suffix: "%" },
                  { label: "Pengguna", value: 50, suffix: "K+" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="group rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-4 transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5"
                  >
                    <div className="text-2xl font-bold text-slate-900">
                      <AnimatedCounter target={s.value} suffix={s.suffix} />
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </FadeIn>

            {/* Trust chips */}
            <FadeIn delay={500}>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                {[
                  { icon: "shield", label: "Privasi utama" },
                  { icon: "bolt", label: "Pengiriman instan" },
                  { icon: "sparkles", label: "UI bersih" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/80 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
                  >
                    <Icon name={chip.icon as any} className="h-3.5 w-3.5 text-emerald-600" />
                    {chip.label}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>

          {/* Right â€” Phone mockup */}
          <div className="lg:col-span-5">
            <FadeIn delay={300} direction="right">
              <div className="relative">
                {/* Glow behind phone */}
                <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-emerald-200/30 via-teal-100/20 to-transparent blur-3xl" />

                <div className="relative">
                  {/* Floating badge */}
                  <div className="absolute left-0 top-8 z-10 animate-float-slow">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200/60 bg-white/95 backdrop-blur-sm px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-xl shadow-emerald-900/10">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                        <Icon name="check" className="h-3.5 w-3.5" />
                      </span>
                      Status pengiriman langsung
                    </div>
                  </div>

                  {/* Stats floating card */}
                  <div className="absolute -right-4 bottom-20 z-10 animate-float-delayed">
                    <div className="rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-sm p-3.5 shadow-xl shadow-slate-900/10">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                          <Icon name="bolt" className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-[10px] font-medium text-slate-400">Rata-rata kirim</div>
                          <div className="text-sm font-bold text-slate-900">~15 dtk</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <img
                    src={phoneHeroImg}
                    alt="Pratinjau dashboard OTP"
                    className="relative w-full max-w-[400px] mx-auto drop-shadow-2xl"
                    loading="lazy"
                  />
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </Container>

      {/* Section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-800" />
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  PRODUCT SECTION                                                   */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function ProductSection({ content }: { content: WebsiteBranding["landingContent"] }) {
  return (
    <section id="product" className="py-20 sm:py-24 scroll-mt-28 relative">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-white pointer-events-none" />

      <Container className="relative">
        <SectionTitle
          eyebrow={content.productEyebrow}
          title={content.productTitle}
          subtitle={content.productSubtitle}
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          {/* Benefits */}
          <div className="lg:col-span-7">
            <FadeIn>
              <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                      <Icon name="check" className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Keunggulan utama</span>
                  </div>
                  <Badge tone="emerald">Andal</Badge>
                </div>

                <div className="mt-5 space-y-2.5">
                  {[
                    "Terima OTP SMS online dalam hitungan menit.",
                    "Pilih dari banyak negara dan layanan.",
                    "Isi saldo mudah dengan harga yang jelas.",
                    "Level diskon untuk pelanggan rutin.",
                    "Dukungan siap saat kamu butuh.",
                  ].map((b, i) => (
                    <FadeIn key={b} delay={i * 80}>
                      <div className="group flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-emerald-50/50">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-all group-hover:bg-emerald-100 group-hover:shadow-sm">
                          <Icon name="check" className="h-3 w-3" />
                        </span>
                        <span>{b}</span>
                      </div>
                    </FadeIn>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    { k: "Negara", v: "180+", icon: "solar:global-bold-duotone", color: "from-blue-500 to-indigo-600" },
                    { k: "Layanan", v: "700+", icon: "solar:widget-bold-duotone", color: "from-violet-500 to-purple-600" },
                    { k: "Pengiriman", v: "Instan", icon: "solar:bolt-bold-duotone", color: "from-amber-500 to-orange-600" },
                  ].map((s, i) => (
                    <FadeIn key={s.k} delay={i * 100}>
                      <div className="group rounded-2xl border border-slate-200/60 bg-white p-4 transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5">
                        <div className="flex items-center gap-2.5">
                          <div className={cx("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm", s.color)}>
                            <Icon name={`iconify:${s.icon}`} className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-lg font-bold text-slate-900">{s.v}</div>
                            <div className="text-[11px] font-medium text-slate-500">{s.k}</div>
                          </div>
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Feature cards */}
          <div className="lg:col-span-5">
            <div className="grid gap-4">
              {[
                {
                  icon: "shield",
                  title: "Perlindungan privasi",
                  desc: "Daftar tanpa membuka nomor asli kamu.",
                  gradient: "from-emerald-500 to-green-600",
                },
                {
                  icon: "bolt",
                  title: "Penerimaan cepat",
                  desc: "Dapatkan kode lebih cepat tanpa ribet SIM.",
                  gradient: "from-amber-500 to-orange-600",
                },
                {
                  icon: "sparkles",
                  title: "Dashboard rapi",
                  desc: "Cari layanan, lihat riwayat, dan kelola saldo.",
                  gradient: "from-violet-500 to-purple-600",
                },
              ].map((x, i) => (
                <FadeIn key={x.title} delay={i * 120} direction="right">
                  <div className="group rounded-2xl border border-slate-200/60 bg-white p-5 transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5">
                    <div className="flex items-start gap-3.5">
                      <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-110", x.gradient)}>
                        <Icon name={x.icon as any} className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{x.title}</div>
                        <div className="mt-1 text-sm text-slate-500 leading-relaxed">{x.desc}</div>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>

        {/* Services + Countries */}
        <div className="mt-8 grid gap-5 lg:grid-cols-12">
          {/* Services directory */}
          <div className="lg:col-span-7">
            <FadeIn delay={100}>
              <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
                      <Icon name="iconify:solar:widget-bold-duotone" className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Layanan populer</span>
                  </div>
                  <Badge tone="slate">Direktori</Badge>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {[
                    { icon: "logos:telegram", name: "Telegram" },
                    { icon: "logos:whatsapp-icon", name: "WhatsApp" },
                    { icon: "logos:google-icon", name: "Google" },
                    { icon: "logos:facebook", name: "Facebook" },
                    { icon: "skill-icons:instagram", name: "Instagram" },
                    { icon: "logos:tiktok-icon", name: "TikTok" },
                  ].map((s) => (
                    <button
                      key={s.name}
                      className="group flex h-12 items-center gap-3 rounded-xl border border-slate-200/60 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-sm"
                      type="button"
                    >
                      <Icon name={`iconify:${s.icon}`} className="w-6 h-6" />
                      <span className="flex-1 text-left text-xs">{s.name}</span>
                      <Icon name="arrowRight" className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/80 p-3.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <Icon name="sparkles" className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold">Tips:</span> Jika layanan yang kamu cari belum ada, pilih{" "}
                    <span className="font-bold text-slate-800">"Lainnya"</span> agar tetap kompatibel.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Countries */}
          <div className="lg:col-span-5">
            <FadeIn delay={200} direction="right">
              <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                    <Icon name="iconify:solar:global-bold-duotone" className="h-4.5 w-4.5 text-white" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Cakupan negara</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  {[
                    { flag: "twemoji:flag-united-states", name: "Amerika Serikat" },
                    { flag: "twemoji:flag-united-kingdom", name: "Inggris" },
                    { flag: "twemoji:flag-indonesia", name: "Indonesia" },
                    { flag: "twemoji:flag-india", name: "India" },
                    { flag: "twemoji:flag-brazil", name: "Brasil" },
                    { flag: "twemoji:flag-germany", name: "Jerman" },
                    { flag: "twemoji:flag-france", name: "Prancis" },
                    { flag: "twemoji:flag-for-flag-turkey", name: "Turki" },
                  ].map((c) => (
                    <div
                      key={c.name}
                      className="group flex items-center gap-2.5 rounded-xl border border-slate-200/60 bg-white p-3 transition-all duration-200 hover:border-emerald-200 hover:shadow-sm cursor-pointer"
                    >
                      <IconifyIcon icon={c.flag} width={24} />
                      <span className="flex-1 text-xs font-semibold text-slate-700 truncate">
                        {c.name}
                      </span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition-all group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-600">
                        <Icon name="arrowRight" className="h-3 w-3" />
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-[11px] text-slate-400">
                  Ketersediaan bisa berubah tergantung waktu dan layanan.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </Container>

      <div className="mt-20 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    </section>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  HOW IT WORKS                                                      */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function HowItWorks({ content }: { content: WebsiteBranding["landingContent"] }) {
  const steps = [
    {
      n: "01",
      title: "Buat akun",
      desc: "Daftar lalu akses dashboard pribadimu.",
      icon: "solar:user-plus-bold-duotone",
      color: "from-blue-500 to-indigo-600",
    },
    {
      n: "02",
      title: "Isi saldo",
      desc: "Tambah dana lewat QRIS atau metode pembayaran lainnya.",
      icon: "solar:wallet-money-bold-duotone",
      color: "from-violet-500 to-purple-600",
    },
    {
      n: "03",
      title: "Pilih layanan & negara",
      desc: "Pilih platform dan wilayah sesuai kebutuhanmu.",
      icon: "solar:global-bold-duotone",
      color: "from-emerald-500 to-teal-600",
    },
    {
      n: "04",
      title: "Beli nomor",
      desc: "Nomor virtual langsung diberikan secara instan.",
      icon: "solar:phone-bold-duotone",
      color: "from-amber-500 to-orange-600",
    },
    {
      n: "05",
      title: "Terima OTP",
      desc: "Tunggu kodenya masuk lalu verifikasi akunmu.",
      icon: "solar:chat-round-check-bold-duotone",
      color: "from-rose-500 to-pink-600",
    },
  ];

  return (
    <section id="how" className="py-20 sm:py-24 scroll-mt-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/30 to-white pointer-events-none" />

      <Container className="relative">
        <SectionTitle
          eyebrow={content.howEyebrow}
          title={content.howTitle}
          subtitle={content.howSubtitle}
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          {/* Steps */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                    <Icon name="iconify:solar:routing-bold-duotone" className="h-4.5 w-4.5 text-white" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Langkah demi langkah</span>
                </div>

              <div className="space-y-3">
                {steps.map((s, i) => (
                  <FadeIn key={s.n} delay={i * 100}>
                    <div className="group flex gap-4 rounded-xl border border-slate-200/60 bg-white p-4 transition-all duration-300 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-500/5 hover:-translate-y-0.5">
                      <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-110", s.color)}>
                        <Icon name={`iconify:${s.icon}`} className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                            LANGKAH {s.n}
                          </span>
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-slate-800">{s.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{s.desc}</div>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>

          {/* Tips panel */}
          <div className="lg:col-span-5">
            <FadeIn delay={200} direction="right">
              <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm lg:sticky lg:top-24">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
                      <Icon name="sparkles" className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Tips</span>
                  </div>
                  <Badge tone="emerald">Bermanfaat</Badge>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-xl bg-gradient-to-r from-sky-50/80 to-blue-50/50 border border-sky-200/40 p-4">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100/80">
                        <Icon name="sparkles" className="h-3.5 w-3.5 text-sky-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-sky-900">Gunakan "Lainnya"</div>
                        <div className="mt-0.5 text-[11px] text-sky-700 leading-relaxed">
                          Kalau layanan yang kamu butuhkan belum ada, pilih "Lainnya" agar tetap kompatibel.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-gradient-to-r from-emerald-50/80 to-teal-50/50 border border-emerald-200/40 p-4">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80">
                        <Icon name="bolt" className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-900">Ketersediaan lebih tinggi</div>
                        <div className="mt-0.5 text-[11px] text-emerald-700 leading-relaxed">
                          Pilih negara dengan stok lebih besar agar lebih cepat dan stabil.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-gradient-to-r from-violet-50/80 to-purple-50/50 border border-violet-200/40 p-4">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100/80">
                        <Icon name="shield" className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-violet-900">Refund otomatis</div>
                        <div className="mt-0.5 text-[11px] text-violet-700 leading-relaxed">
                          Jika SMS tidak masuk, saldo kamu akan dikembalikan otomatis.
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full !h-10 !text-xs !font-bold"
                    rightIcon="arrowRight"
                    onClick={() =>
                      document.getElementById("product")?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Jelajahi layanan
                  </Button>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </Container>

      <div className="mt-20 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    </section>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  FAQ                                                               */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function FAQ({ content }: { content: WebsiteBranding["landingContent"] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const faqs = useMemo(
    () => [
      {
        q: "Apa itu nomor virtual untuk OTP?",
        a: "Nomor sementara yang kamu beli untuk menerima SMS verifikasi (OTP) tanpa memakai SIM pribadi. Privasi lebih aman dan tetap bisa daftar di berbagai platform.",
      },
      {
        q: "Bagaimana kalau OTP tidak masuk?",
        a: "Coba pilih negara lain atau beli nomor lain. Jika tidak ada SMS sampai batas waktu, saldo akan dikembalikan otomatis.",
      },
      {
        q: "Apakah bisa pilih negara tertentu?",
        a: "Bisa. Tersedia 180+ negara tergantung stok saat itu. Negara populer seperti AS, Inggris, dan Indonesia biasanya stoknya banyak.",
      },
      {
        q: "Layanan apa saja yang didukung?",
        a: "Ada 700+ layanan termasuk Telegram, WhatsApp, Google, Facebook, Instagram, dan lainnya. Untuk platform yang belum ada, gunakan opsi \"Lainnya\".",
      },
      {
        q: "Apakah ada diskon?",
        a: "Ada. Kami menyediakan tier diskon berdasarkan volume top up dan level loyalitas. Pelanggan rutin otomatis mendapat harga lebih baik.",
      },
    ],
    []
  );

  return (
    <section id="faq" className="py-20 sm:py-24 scroll-mt-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/30 to-white pointer-events-none" />

      <Container className="relative">
        <SectionTitle
          eyebrow={content.faqEyebrow}
          title={content.faqTitle}
          subtitle={content.faqSubtitle}
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          {/* FAQ items */}
          <div className="lg:col-span-7">
            <FadeIn>
              <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
                    <Icon name="iconify:solar:question-circle-bold-duotone" className="h-4.5 w-4.5 text-white" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Jawaban</span>
                </div>

                <div className="space-y-2.5">
                  {faqs.map((f, i) => {
                    const isOpen = openIdx === i;
                    return (
                      <FadeIn key={f.q} delay={i * 80}>
                        <div
                          className={cx(
                            "rounded-xl border transition-all duration-300",
                            isOpen
                              ? "border-emerald-200 bg-emerald-50/30 shadow-sm"
                              : "border-slate-200/60 bg-white hover:border-slate-300"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenIdx(isOpen ? null : i)}
                            className="flex w-full items-center justify-between gap-3 p-4 text-left"
                          >
                            <span className="text-sm font-bold text-slate-800">{f.q}</span>
                            <span
                              className={cx(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-300",
                                isOpen
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-700 rotate-180"
                                  : "border-slate-200 bg-slate-50 text-slate-400"
                              )}
                            >
                              <Icon name="iconify:solar:alt-arrow-down-bold" className="h-3.5 w-3.5" />
                            </span>
                          </button>
                          <div
                            className={cx(
                              "overflow-hidden transition-all duration-300",
                              isOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                            )}
                          >
                            <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                              {f.a}
                            </div>
                          </div>
                        </div>
                      </FadeIn>
                    );
                  })}
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Contact form */}
          <div className="lg:col-span-5">
            <FadeIn delay={200} direction="right">
              <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm lg:sticky lg:top-24">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                      <Icon name="iconify:solar:chat-round-dots-bold-duotone" className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Kontak</span>
                  </div>
                  <Badge tone="emerald">Bantuan</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="rounded-xl bg-gradient-to-r from-emerald-50/80 to-teal-50/50 border border-emerald-200/40 p-4">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80">
                        <Icon name="iconify:solar:chat-round-check-bold-duotone" className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-900">Butuh bantuan?</div>
                        <div className="mt-0.5 text-[11px] text-emerald-700 leading-relaxed">
                          Kirim pesan ke kami, tim akan membalas secepat mungkin.
                        </div>
                      </div>
                    </div>
                  </div>

                  <Input
                    label="Email"
                    placeholder="kamu@email.com"
                    leftIcon="iconify:solar:letter-bold-duotone"
                  />
                  <Input
                    label="Pesan"
                    placeholder="Ceritakan kendalanya..."
                    leftIcon="iconify:solar:chat-line-bold-duotone"
                  />
                  <Button
                    size="sm"
                    rightIcon="arrowRight"
                    className="w-full !h-10 !text-xs !font-bold"
                  >
                    Kirim pesan
                  </Button>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  CTA SECTION                                                       */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function CTASection({ content }: { content: WebsiteBranding["landingContent"] }) {
  return (
    <section className="py-20 sm:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>
      <div className="absolute top-0 right-0 h-[400px] w-[400px] rounded-full bg-white/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-white/5 blur-3xl" />

      <Container className="relative">
        <FadeIn className="text-center">
          <div className="mx-auto max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 text-xs font-bold text-white/90 ring-1 ring-white/20">
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              {content.ctaBadge}
            </div>
            <h2 className="text-3xl font-bold text-white sm:text-4xl leading-tight">
              {content.ctaTitle}
            </h2>
            <p className="mt-4 text-base text-white/80 leading-relaxed">
              {content.ctaSubtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/register">
                <Button
                  className="!h-12 !px-8 !text-sm !font-bold !bg-white !text-emerald-700 hover:!bg-white/90"
                  rightIcon="arrowRight"
                >
                  {content.ctaPrimaryCta}
                </Button>
              </Link>
              <Button
                variant="secondary"
                className="!h-12 !px-8 !text-sm !font-bold !bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
                onClick={() =>
                  document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {content.ctaSecondaryCta}
              </Button>
            </div>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  FOOTER                                                            */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function Footer({ branding }: { branding: WebsiteBranding }) {
  const siteName = branding.siteName || "OTP Seller";
  const siteDescription =
    branding.siteDescription || "Terima OTP SMS online menggunakan nomor virtual.";
  const logoUrl = branding.logoUrl;

  return (
    <footer className="border-t border-slate-200/60 bg-gradient-to-b from-white to-slate-50/50">
      <Container>
        <div className="grid gap-10 py-14 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <img src={logoUrl} alt={siteName} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                  <Icon name="bolt" className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-slate-900">{siteName}</div>
                <div className="text-[10px] font-medium text-slate-500">
                  {siteDescription}
                </div>
              </div>
            </div>

            <p className="mt-5 max-w-md text-sm text-slate-500 leading-relaxed">
              {siteDescription}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Semua sistem normal
              </span>
              <Badge tone="slate">180+ negara</Badge>
              <Badge tone="slate">700+ layanan</Badge>
            </div>
          </div>

          {/* Links */}
          <div className="grid gap-8 sm:grid-cols-3 lg:col-span-7">
            {[
              {
                title: "Produk",
                icon: "solar:widget-bold-duotone",
                links: [
                  { label: "Ringkasan", href: "#product" },
                  { label: "Cara kerja", href: "#how" },
                  { label: "FAQ", href: "#faq" },
                ],
              },
              {
                title: "Bantuan",
                icon: "solar:question-circle-bold-duotone",
                links: [
                  { label: "Dukungan", href: "#faq" },
                  { label: "Hubungi kami", href: "#" },
                  { label: "Status", href: "#" },
                ],
              },
              {
                title: "Kebijakan",
                icon: "solar:shield-check-bold-duotone",
                links: [
                  { label: "Privasi", href: "#" },
                  { label: "Syarat", href: "#" },
                  { label: "Pengembalian dana", href: "#" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <div className="flex items-center gap-2">
                  <Icon name={`iconify:${col.icon}`} className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {col.title}
                  </span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {col.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      className="block text-sm font-medium text-slate-600 transition-colors hover:text-emerald-700"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-3 border-t border-slate-200/60 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            © {new Date().getFullYear()} {siteName}. Semua hak dilindungi.
          </div>
          <div className="flex gap-4 text-xs text-slate-400">
            <a href="#" className="transition-colors hover:text-emerald-700">
              Syarat
            </a>
            <a href="#" className="transition-colors hover:text-emerald-700">
              Privasi
            </a>
            <a href="#" className="transition-colors hover:text-emerald-700">
              Pengembalian dana
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/*  LANDING PAGE                                                      */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function LandingPage() {
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

  useEffect(() => {
    const seo = branding.seo;
    const pageTitle =
      String(seo.metaTitle ?? "").trim() || `${branding.siteName} - ${branding.siteDescription}`;
    const pageDescription =
      String(seo.metaDescription ?? "").trim() || branding.siteDescription;
    const ogImage = seo.ogImageUrl || branding.logoUrl || "";

    document.title = pageTitle;
    upsertMeta('meta[name="description"]', {
      name: "description",
      content: pageDescription,
    });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: seo.robotsNoIndex ? "noindex, nofollow" : "index, follow",
    });

    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: pageTitle });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: pageDescription,
    });
    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: ogImage || "",
    });

    upsertMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: seo.twitterCard || "summary_large_image",
    });
    upsertMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: pageTitle,
    });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: pageDescription,
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: ogImage || "",
    });

    const favicon = seo.faviconUrl || branding.logoUrl || "";
    if (favicon) {
      upsertLink('link[rel="icon"]', { rel: "icon", href: favicon });
    }
  }, [branding]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header branding={branding} />
      <Hero content={branding.landingContent} />
      <ProductSection content={branding.landingContent} />
      <HowItWorks content={branding.landingContent} />
      <FAQ content={branding.landingContent} />
      <CTASection content={branding.landingContent} />
      <Footer branding={branding} />

      {/* Global animation styles */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-15px) rotate(3deg); }
          66% { transform: translateY(8px) rotate(-2deg); }
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
        }

        @keyframes float-delayed {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .animate-float-delayed {
          animation: float-delayed 5s ease-in-out infinite;
          animation-delay: 1.5s;
        }
      `}</style>
    </div>
  );
}

