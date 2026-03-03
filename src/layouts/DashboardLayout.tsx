import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { sileo } from "sileo";
import { Button, Icon } from "../components/ui";
import { useAuth } from "../auth/useAuth";
import { UserRouteTransition } from "../components/pageTransition";
import { API_BASE, apiFetch } from "../lib/api";
import ThemeToggleButton from "../components/ThemeToggleButton";

type NavItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: string;
  group: "main" | "system";
};

type BottomNavItem = Pick<NavItem, "to" | "label" | "icon" | "end">;

type WebsiteBranding = {
  siteName: string;
  siteDescription: string;
  logoUrl?: string | null;
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
};

function cx(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

function resolveMediaUrl(url?: string | null) {
  const value = String(url ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return `${API_BASE}${value.startsWith("/") ? "" : "/"}${value}`;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function listener(e: MouseEvent | TouchEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    }
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

export default function DashboardLayout() {
  const { user, logout } = useAuth() as any;
  const nav = useNavigate();
  const loc = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [websiteBranding, setWebsiteBranding] = useState<WebsiteBranding | null>(null);
  const [websiteSettingsLoaded, setWebsiteSettingsLoaded] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const maintenanceToastLockRef = useRef(false);

  useClickOutside(profileRef, () => setProfileOpen(false));

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await apiFetch("/api/website", { method: "GET" });
        if (!active) return;
        setWebsiteBranding(data?.settings ?? null);
      } catch {
        if (!active) return;
        setWebsiteBranding(null);
      } finally {
        if (!active) return;
        setWebsiteSettingsLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const isOrderBlockedByMaintenance =
    websiteSettingsLoaded &&
    Boolean(websiteBranding?.maintenanceMode) &&
    loc.pathname.startsWith("/orders");

  useEffect(() => {
    if (!isOrderBlockedByMaintenance) {
      maintenanceToastLockRef.current = false;
      return;
    }
    if (maintenanceToastLockRef.current) return;
    maintenanceToastLockRef.current = true;

    sileo.warning({
      title: "Order dinonaktifkan saat maintenance",
      description:
        String(websiteBranding?.maintenanceMessage ?? "").trim() ||
        "Silakan kembali ke dashboard, order akan dibuka lagi setelah maintenance selesai.",
      position: "top-center",
    });
    nav("/", { replace: true });
  }, [isOrderBlockedByMaintenance, nav, websiteBranding?.maintenanceMessage]);

  const items: NavItem[] = useMemo(
    () => [
      { to: "/", label: "Halaman Utama", icon: "iconify:solar:home-2-bold-duotone", end: true, group: "main" },
      { to: "/orders", label: "Beli OTP", icon: "iconify:solar:bill-list-bold-duotone", group: "main" },
      { to: "/numbers", label: "Pesanan Saya", icon: "iconify:solar:sim-cards-bold-duotone", group: "main" },
      { to: "/deposit", label: "Isi Saldo", icon: "iconify:solar:wallet-money-bold-duotone", group: "system" },
      { to: "/mutasi-saldo", label: "Mutasi Saldo", icon: "iconify:solar:card-recive-bold-duotone", group: "system" },
      { to: "/history", label: "Riwayat", icon: "iconify:solar:clock-circle-bold-duotone", group: "system" },
    ],
    []
  );

  const mainItems = items.filter((i) => i.group === "main");
  const systemItems = items.filter((i) => i.group === "system");
  const mobileBottomItems: BottomNavItem[] = useMemo(
    () => [
      { to: "/orders", label: "Order", icon: "iconify:solar:bill-list-bold-duotone" },
      { to: "/numbers", label: "Pesanan", icon: "iconify:solar:sim-cards-bold-duotone" },
      { to: "/", label: "Home", icon: "iconify:solar:home-2-bold-duotone", end: true },
      { to: "/history", label: "Riwayat", icon: "iconify:solar:clock-circle-bold-duotone" },
      { to: "/settings", label: "Akun", icon: "iconify:solar:user-bold-duotone" },
    ],
    []
  );

  const onLogout = useCallback(async () => {
    setProfileOpen(false);
    try {
      await logout?.();
    } finally {
      nav("/login", { replace: true });
    }
  }, [logout, nav]);

  const balanceLabel = useMemo(() => {
    const value = Number(user?.balance ?? 0);
    const safe = Number.isFinite(value) ? value : 0;
    const text = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(safe);
    return `${text}`;
  }, [user?.balance]);

  return (
    <>
      <style>{`
        .sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .sidebar-scroll:hover {
          scrollbar-color: rgba(148,163,184,0.3) transparent;
        }
        .sidebar-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 9999px;
        }
        .sidebar-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,0.3);
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148,163,184,0.5);
        }
      `}</style>

      <div className="min-h-[100dvh] h-[100dvh] overflow-hidden bg-slate-50/80 dark:bg-slate-950/90">
        {/* Ambient blurs */}
        <div className="pointer-events-none fixed inset-0 hidden overflow-hidden md:block">
          <div className="absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-emerald-100/35 blur-[120px]" />
          <div className="absolute bottom-[-5rem] right-[-5rem] h-[350px] w-[350px] rounded-full bg-emerald-50/45 blur-[100px]" />
          <div className="absolute top-1/2 left-[-8rem] h-[280px] w-[280px] rounded-full bg-emerald-100/25 blur-[100px]" />
        </div>

        <div className="relative flex h-[100dvh]">
          {/* ═══ SIDEBAR — Desktop ═══ */}
          <aside className="hidden w-[264px] shrink-0 flex-col border-r border-slate-200/70 bg-white/70 backdrop-blur-2xl md:flex h-screen sticky top-0">
            <SidebarBrand branding={websiteBranding} />
            <div className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden">
              <SidebarNavGroup label="Navigation" items={mainItems} />
              <SidebarNavGroup label="System" items={systemItems} />
            </div>
            <SidebarProfile user={user} onLogout={onLogout} nav={nav} />
          </aside>

          {/* ═══ SIDEBAR — Mobile Drawer ═══ */}
          <div
            className={cx(
              "fixed inset-0 z-50 md:hidden transition-opacity duration-300",
              mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <div className="absolute inset-0 bg-slate-900/45" onClick={() => setMobileOpen(false)} />
            <div
              className={cx(
                "absolute inset-y-0 left-0 w-[85%] max-w-[300px] transform-gpu bg-white shadow-2xl shadow-slate-900/20 transition-transform duration-300 ease-out flex flex-col",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              )}
            >
              <SidebarBrand branding={websiteBranding} onClose={() => setMobileOpen(false)} />
              <div className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden">
                <SidebarNavGroup label="Navigation" items={mainItems} onNavigate={() => setMobileOpen(false)} />
                <SidebarNavGroup label="System" items={systemItems} onNavigate={() => setMobileOpen(false)} />
              </div>
              <SidebarProfile user={user} onLogout={onLogout} nav={nav} />
            </div>
          </div>

          {/* ═══ MAIN CONTENT ═══ */}
          <div className="flex min-w-0 flex-1 flex-col h-[100dvh] overflow-hidden">
            {/* Topbar */}
            <header className="sticky top-0 shrink-0 z-40 border-b border-slate-200/70 bg-white/95 supports-[backdrop-filter]:bg-white/80 md:backdrop-blur-lg dark:border-slate-800/80 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/80">
              <div className="mx-auto flex items-center gap-3 px-4 py-2.5 sm:px-6">
                <button
                  type="button"
                  className="group inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 md:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  <Icon
                    name="iconify:streamline-flex:layout-window-1"
                    className="h-5 w-5 transition-transform group-active:scale-90"
                  />
                </button>

                <div className="flex-1" />

                <ThemeToggleButton size="md" className="shrink-0" />

                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon="iconify:streamline-plump:wallet"
                  rightIcon="iconify:octicon:feed-plus-16"
                  onClick={() => nav("/deposit")}
                  className="hidden sm:inline-flex"
                >
                  {balanceLabel}
                </Button>

                <div className="hidden h-8 w-px bg-slate-200/80 md:block" />

                {/* Profile dropdown */}
                <div ref={profileRef} className="relative hidden md:block rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    className={cx(
                      "flex items-center gap-2.5 cursor-pointer rounded-xl px-2.5 py-1.5 transition-colors",
                      profileOpen ? "bg-slate-100" : "hover:bg-slate-50"
                    )}
                    onClick={() => {
                      setProfileOpen(!profileOpen);
                    }}
                  >
                    <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {(user?.name ?? "A").charAt(0).toUpperCase()}
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600" />
                    </span>
                    <div className="max-w-[130px] text-left">
                      <div className="truncate text-[12px] font-semibold text-slate-800">
                        {user?.name ?? "Account"}
                      </div>
                      <div className="truncate text-[10px] text-slate-400">{user?.email ?? "—"}</div>
                    </div>
                    <Icon
                      name="iconify:grommet-icons:down"
                      className={cx(
                        "h-4 w-4 text-slate-400 transition-transform duration-200",
                        profileOpen && "rotate-180"
                      )}
                    />
                  </button>

                  <div
                    className={cx(
                      "absolute right-0 top-full mt-2 w-[240px] origin-top-right rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-200/50 transition-all duration-200",
                      profileOpen
                        ? "pointer-events-auto scale-100 opacity-100 translate-y-0"
                        : "pointer-events-none scale-95 opacity-0 -translate-y-1"
                    )}
                  >
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 mb-1.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                        {(user?.name ?? "A").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-slate-800">
                          {user?.name ?? "Account"}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">{user?.email ?? "—"}</div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Online
                        </div>
                      </div>
                    </div>

                    <DropdownItem
                      icon="iconify:solar:settings-bold-duotone"
                      label="Settings"
                      desc="Preferences & security"
                      onClick={() => { setProfileOpen(false); nav("/settings"); }}
                    />

                    <div className="my-1.5 h-px bg-slate-100" />

                    <button
                      type="button"
                      onClick={onLogout}
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-950/35"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 transition group-hover:bg-red-100 dark:bg-red-950/35 dark:text-red-300 dark:group-hover:bg-red-900/45">
                        <Icon name="iconify:solar:logout-2-bold-duotone" className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-[12px] font-semibold text-red-600 dark:text-red-300">Log Out</div>
                        <div className="text-[10px] text-red-400 dark:text-red-400/85">End your session</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {/* ═══ Scrollable content + footer ═══ */}
            <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">

              <div className="flex min-h-full flex-col pb-24 md:pb-0">
                {/* Page content */}
                <main className="mx-auto w-full min-w-0 flex-1 px-4 py-5 sm:px-6">

                  <UserRouteTransition
                    transitionKey={loc.pathname}
                    routePath={loc.pathname}
                    variant="dashboard"
                    minDurationMs={240}
                    className="min-h-[60vh]"
                  >
                    {isOrderBlockedByMaintenance ? <div className="min-h-[40vh]" aria-hidden="true" /> : <Outlet />}
                  </UserRouteTransition>
                </main>

                {/* Footer — always at the very bottom */}
                <footer className="mt-auto hidden shrink-0 border-t border-slate-200/50 bg-gradient-to-r from-white/80 via-slate-50/60 to-white/80 md:block md:backdrop-blur-xl dark:border-slate-700/40 dark:from-slate-950/90 dark:via-slate-900/80 dark:to-slate-950/90">
                  <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                      {/* Left - Brand & Copyright */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/20 dark:shadow-emerald-500/10">
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-semibold tracking-tight text-slate-700 dark:text-slate-200">
                            {websiteBranding?.siteName || "OTP Seller"}
                          </span>
                          <span className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500">
                            © {new Date().getFullYear()} All rights reserved
                          </span>
                        </div>
                      </div>

                      {/* Center - Creator Credit */}
                      <a
                        href="https://wa.me/6285237561797"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/70 px-4 py-1.5 backdrop-blur-sm transition-all duration-300 hover:border-emerald-300/80 hover:shadow-md hover:shadow-emerald-500/10 dark:border-slate-700/50 dark:bg-slate-800/50 dark:hover:border-emerald-500/40"
                      >
                        <svg className="h-3.5 w-3.5 text-slate-400 transition-colors duration-300 group-hover:text-emerald-500 dark:text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                        </svg>
                        <span className="text-[10.5px] font-medium tracking-wide text-slate-500 transition-colors duration-300 group-hover:text-emerald-600 dark:text-slate-400 dark:group-hover:text-emerald-400">
                          Crafted by
                        </span>
                        <span className="bg-gradient-to-r from-emerald-600 to-emerald-600 bg-clip-text text-[11px] font-bold tracking-wide text-transparent dark:from-emerald-400 dark:to-emerald-400">
                          NurCode
                        </span>
                        <svg className="h-3 w-3 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-emerald-500 dark:text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </a>

                      {/* Right - System Status */}
                      <div className="flex items-center gap-4">
                        <div className="group flex items-center gap-2.5 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-3.5 py-1.5 transition-all duration-300 hover:border-emerald-300/80 hover:shadow-sm hover:shadow-emerald-500/10 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:hover:border-emerald-500/30">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 dark:bg-emerald-500" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                          </span>
                          <span className="text-[11px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-400">
                            All systems operational
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>
            </div>
          </div>

          <MobileBottomNav items={mobileBottomItems} />
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════ */

function DropdownItem({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: string;
  label: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 group"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition">
        <Icon name={icon as any} className="h-4 w-4" />
      </span>
      <div>
        <div className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900 transition">
          {label}
        </div>
        {desc && <div className="text-[10px] text-slate-400">{desc}</div>}
      </div>
    </button>
  );
}

function MobileBottomNav({ items }: { items: BottomNavItem[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div
        className="border-t border-slate-200/50 bg-white/70 backdrop-blur-3xl dark:border-white/[0.04] dark:bg-slate-950/70"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto grid max-w-[500px] grid-cols-5 px-4 pt-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  "group flex flex-col items-center gap-0.5 py-2 transition-all duration-200",
                  isActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400 active:scale-90 active:opacity-60 dark:text-slate-500"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Clean icon — no background box */}
                  <span className="relative flex h-7 items-center justify-center">
                    <Icon
                      name={item.icon as any}
                      className={cx(
                        "h-[22px] w-[22px] transition-all duration-200",
                        isActive && "scale-105"
                      )}
                    />
                    {/* Soft glow for active */}
                    {isActive && (
                      <span className="absolute inset-0 -z-10 scale-150 rounded-full bg-emerald-400/15 blur-lg dark:bg-emerald-400/10" />
                    )}
                  </span>

                  {/* Minimal label */}
                  <span
                    className={cx(
                      "text-[10px] font-semibold tracking-wide",
                      isActive
                        ? "opacity-100"
                        : "opacity-60 group-hover:opacity-80"
                    )}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
/* ══════════════════════════════════════════════
   SIDEBAR SUBCOMPONENTS
   ══════════════════════════════════════════════ */

function SidebarBrand({
  branding,
  onClose,
}: {
  branding?: WebsiteBranding | null;
  onClose?: () => void;
}) {
  const logoUrl = resolveMediaUrl(branding?.logoUrl);

  return (
    <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          <img src={logoUrl} alt="Website logo" className="h-10 w-10 rounded-xl border border-slate-200 object-cover" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Icon name="iconify:solar:shield-check-bold-duotone" className="h-5 w-5" />
          </span>
        )}
        <div>
          <div className="text-[14px] font-bold text-slate-900 tracking-tight">
            {branding?.siteName || "OTP Seller"}
          </div>
          <div className="line-clamp-1 text-[10px] font-medium text-emerald-600">
            {branding?.siteDescription || "Pro Dashboard"}
          </div>
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          onClick={onClose}
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}



function SidebarNavGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  return (
    <div className="px-3 pt-4">
      <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "bg-emerald-50/80 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-600 transition-all duration-300" />
                )}
                <span
                  className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                      : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"
                  )}
                >
                  <Icon name={item.icon as any} className="h-[16px] w-[16px]" />
                </span>
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-md bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}



function SidebarProfile({
  user,
  onLogout,
  nav,
}: {
  user: any;
  onLogout: () => void;
  nav: ReturnType<typeof useNavigate>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative shrink-0 border-t block md:hidden border-slate-100 p-3">
      <button
        type="button"
        className={cx(
          "flex w-full items-center gap-2.5 rounded-xl p-2.5 transition-colors",
          open ? "bg-slate-100" : "hover:bg-slate-50"
        )}
        onClick={() => setOpen(!open)}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-sm shadow-emerald-500/20">
          {(user?.name ?? "A").charAt(0).toUpperCase()}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-[12px] font-semibold text-slate-800">
            {user?.name ?? "Account"}
          </div>
          <div className="truncate text-[10px] text-slate-400">{user?.email ?? "—"}</div>
        </div>
        <Icon
          name="iconify:grommet-icons:up"
          className={cx(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            open ? "rotate-0" : "rotate-180"
          )}
        />
      </button>

      <div
        className={cx(
          "absolute inset-x-3 bottom-full mb-2 origin-bottom rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-200/50 transition-all duration-200",
          open
            ? "pointer-events-auto scale-100 opacity-100 translate-y-0"
            : "pointer-events-none scale-95 opacity-0 translate-y-1"
        )}
      >

        <DropdownItem
          icon="iconify:solar:settings-bold-duotone"
          label="Settings"
          desc="Preferences & security"
          onClick={() => { setOpen(false); nav("/settings"); }}
        />

        <div className="my-1 h-px bg-slate-100" />

        <button
          type="button"
          onClick={() => { setOpen(false); onLogout(); }}
          className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-950/35"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 transition group-hover:bg-red-100 dark:bg-red-950/35 dark:text-red-300 dark:group-hover:bg-red-900/45">
            <Icon name="iconify:solar:logout-2-bold-duotone" className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[12px] font-semibold text-red-600 dark:text-red-300">Log Out</div>
            <div className="text-[10px] text-red-400 dark:text-red-400/85">End session</div>
          </div>
        </button>
      </div>
    </div>
  );
}
