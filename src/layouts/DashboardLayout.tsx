import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Icon } from "../components/ui";
import { useAuth } from "../auth/useAuth";
import { UserRouteTransition } from "../components/pageTransition";
import { API_BASE, apiFetch } from "../lib/api";

type NavItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: string;
  group: "main" | "system";
};

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
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [websiteBranding, setWebsiteBranding] = useState<WebsiteBranding | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useClickOutside(profileRef, () => setProfileOpen(false));
  useClickOutside(notifRef, () => setNotifOpen(false));

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
      }
    })();

    return () => {
      active = false;
    };
  }, []);

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

  const currentPage = useMemo(() => {
    const hit = items.find((x) => (x.end ? loc.pathname === x.to : loc.pathname.startsWith(x.to)));
    return hit ?? { label: "Dashboard", icon: "iconify:solar:home-2-bold-duotone" };
  }, [items, loc.pathname]);

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
    return `Saldo: ${text}`;
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

      <div className="h-screen overflow-hidden bg-slate-50/80">
        {/* Ambient blurs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-emerald-100/50 blur-[120px] animate-[pulse_8s_ease-in-out_infinite]" />
          <div className="absolute bottom-[-5rem] right-[-5rem] h-[350px] w-[350px] rounded-full bg-emerald-50/60 blur-[100px] animate-[pulse_10s_ease-in-out_infinite_1s]" />
          <div className="absolute top-1/2 left-[-8rem] h-[280px] w-[280px] rounded-full bg-emerald-100/30 blur-[100px] animate-[pulse_12s_ease-in-out_infinite_2s]" />
        </div>

        <div className="relative flex h-screen">
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
            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div
              className={cx(
                "absolute inset-y-0 left-0 w-[85%] max-w-[300px] bg-white shadow-2xl shadow-slate-900/20 transition-transform duration-300 ease-out flex flex-col",
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
          <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
            {/* Topbar */}
            <header className="shrink-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur-2xl">
              <div className="mx-auto flex items-center gap-3 px-4 py-[10px] sm:py-1.5 sm:px-6">
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

                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon="iconify:solar:add-square-bold-duotone"
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
                      setNotifOpen(false);
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
            <div className="flex-1 overflow-x-hidden overflow-y-auto scroll-smooth">

              <div className="flex min-h-full flex-col">
                {/* Page content */}
                <main className="mx-auto w-full min-w-0 flex-1 px-4 py-5 sm:px-6">
                
                  <UserRouteTransition
                    transitionKey={loc.pathname}
                    routePath={loc.pathname}
                    variant="dashboard"
                    minDurationMs={240}
                    className="min-h-[60vh]"
                  >
                    <Outlet />
                  </UserRouteTransition>
                </main>

                {/* Footer — always at the very bottom */}
                <footer className="mt-auto shrink-0 border-t border-slate-200/70 bg-white/50 backdrop-blur">
                  <div className="mx-auto flex flex-col gap-2 px-4 py-4 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <span>
                      © {new Date().getFullYear()} {websiteBranding?.siteName || "OTP Seller"} • Built with security
                      in mind
                    </span>
                    <div className="flex items-center gap-4">

                      <span className="inline-flex items-center gap-1.5 text-emerald-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        All systems normal
                      </span>
                    </div>
                  </div>
                </footer>
              </div>
            </div>
          </div>
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
