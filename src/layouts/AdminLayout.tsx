// src/layouts/AdminLayout.tsx
import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuthProvider";
import { UserRouteTransition } from "../components/pageTransition";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardContent,
  Icon,
  Input,
} from "../components/ui";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type NavItem = {
  to: string;
  label: string;
  desc: string;
  icon: string;
  chip?: { text: string; tone?: "emerald" | "slate" | "amber" | "rose" };
};

/* ------------------------------------------------------------------ */
/*  SUB-COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

function TopKbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 shadow-sm">
      {children}
    </span>
  );
}

function SideNavItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/admin"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-emerald-50 to-teal-50/50 text-emerald-900 shadow-sm shadow-emerald-500/5"
            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator bar */}
          {isActive && (
            <div className="absolute -left-px top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-500" />
          )}

          <span
            className={cx(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-all duration-200",
              isActive
                ? "border-emerald-200 bg-white text-emerald-600 shadow-sm"
                : "border-zinc-200/80 bg-white text-zinc-500 group-hover:border-zinc-300 group-hover:text-zinc-700"
            )}
          >
            <Icon name={`iconify:${item.icon}`} className="h-[18px] w-[18px]" />
          </span>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cx(
                    "truncate text-[13px] font-semibold",
                    isActive ? "text-emerald-800" : ""
                  )}
                >
                  {item.label}
                </span>
                {item.chip && (
                  <span
                    className={cx(
                      "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      item.chip.tone === "emerald"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.chip.tone === "amber"
                          ? "bg-amber-100 text-amber-700"
                          : item.chip.tone === "rose"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-zinc-100 text-zinc-600"
                    )}
                  >
                    {item.chip.tone === "emerald" && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                    )}
                    {item.chip.text}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                {item.desc}
              </p>
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}

function MobileSidebar({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cx(
          "lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={cx(
          "lg:hidden fixed left-0 top-0 z-50 h-full w-[85%] max-w-[320px] bg-white shadow-2xl shadow-black/10 transition-transform duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {children}
      </div>
    </>
  );
}

function PageTitle() {
  const loc = useLocation();
  const path = loc.pathname;

  const map: Record<string, { title: string; subtitle: string }> = {
    "/admin": {
      title: "Overview",
      subtitle: "Statistik & platform health",
    },
  };

    const match = Object.entries(map).find(([k]) => path === k)?.[1] ??
      (path.startsWith("/admin/orders")
      ? { title: "Orders", subtitle: "Monitor transaksi dan status OTP" }
      : path.startsWith("/admin/users")
        ? { title: "Users", subtitle: "Kelola akun, limit, dan akses" }
        : path.startsWith("/admin/news")
          ? { title: "News", subtitle: "Kelola info yang tampil di dashboard user" }
          : path.startsWith("/admin/website")
            ? { title: "Website Setting", subtitle: "Branding, maintenance, dan banner slider" }
        : path.startsWith("/admin/services")
          ? {
            title: "Services",
            subtitle: "Katalog layanan & sync provider",
          }
          : { title: "Admin", subtitle: "Admin area" });

  return (
    <div className="min-w-0">
      <h1 className="truncate text-sm font-bold text-zinc-900">
        {match.title}
      </h1>
      <p className="truncate text-[11px] text-zinc-500">{match.subtitle}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN LAYOUT                                                        */
/* ------------------------------------------------------------------ */

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { admin, adminLogout } = useAdminAuth();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const items: NavItem[] = [
    {
      to: "/admin",
      label: "Overview",
      desc: "Stats & platform health",
      icon: "solar:chart-square-bold-duotone",
    },
    {
      to: "/admin/orders",
      label: "Orders",
      desc: "Transactions, status, retries",
      icon: "solar:clipboard-list-bold-duotone",
      chip: { text: "Live", tone: "emerald" },
    },
    {
      to: "/admin/users",
      label: "Users",
      desc: "Accounts, limits, roles",
      icon: "solar:users-group-rounded-bold-duotone",
    },
    {
      to: "/admin/news",
      label: "News/Info",
      desc: "Info card untuk dashboard user",
      icon: "solar:document-text-bold-duotone",
    },
    {
      to: "/admin/website",
      label: "Website Setting",
      desc: "Logo, maintenance, dan banner",
      icon: "solar:settings-bold-duotone",
    },
    {
      to: "/admin/services",
      label: "Services",
      desc: "Catalog & provider sync",
      icon: "solar:widget-2-bold-duotone",
    },
    {
      to: "/admin/pricing",
      label: "Pricing",
      desc: "Profit & rate settings",
      icon: "mdi:cash-multiple",
    }
  ];

  async function onLogout() {
    try {
      await adminLogout();
    } finally {
      nav("/admin/login", { replace: true });
    }
  }

  /* ---------- Sidebar Inner ---------- */
  function SidebarInner({ isMobile }: { isMobile: boolean }) {
    const isExpanded = !collapsed || isMobile;

    return (
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/25">
              HS
            </div>

            {isExpanded && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-zinc-900">
                  HeroSMS
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  {admin?.email ?? "Admin Portal"}
                </p>
              </div>
            )}

            {isMobile && (
              <button
                onClick={() => setMobileOpen(false)}
                className="ml-auto flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700"
                aria-label="Close menu"
              >
                <Icon
                  name="iconify:streamline-flex:layout-window-1"
                  className="h-4 w-4"
                />
              </button>
            )}
          </div>
        </div>



        {/* Divider + section label */}
        <div className="px-4 pb-2">
          {isExpanded ? (
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Navigation
            </p>
          ) : (
            <div className="mx-auto h-px w-6 bg-zinc-200" />
          )}
        </div>

        {/* Nav items */}
        <div className="flex-1 space-y-1 overflow-y-auto px-3 scrollbar-thin">
          {items.map((it) => (
            <SideNavItem
              key={it.to}
              item={it}
              collapsed={collapsed && !isMobile}
              onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
            />
          ))}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-zinc-100 p-3 space-y-2">
          {!isMobile && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-700"
            >
              <Icon
                name={
                  collapsed
                    ? "iconify:solar:alt-arrow-right-bold-duotone"
                    : "iconify:solar:alt-arrow-left-bold-duotone"
                }
                className="h-4 w-4"
              />
              {isExpanded && <span>Collapse sidebar</span>}
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200/60 bg-red-50/50 px-3 py-2.5 text-xs font-semibold text-red-600 transition-all duration-200 hover:bg-red-50 hover:shadow-sm dark:border-red-800/45 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/35"
          >
            <Icon
              name="iconify:solar:logout-2-bold-duotone"
              className="h-4 w-4"
            />
            {isExpanded && <span>Logout Admin</span>}
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/20">
      {/* ===== Desktop Sidebar ===== */}
      <aside
        className={cx(
          "hidden lg:flex h-screen sticky top-0 flex-col border-r border-zinc-200/80 bg-white/90 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]",
          collapsed ? "w-[76px]" : "w-[280px]"
        )}
      >
        <SidebarInner isMobile={false} />
      </aside>

      {/* ===== Mobile Sidebar ===== */}
      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      >
        <SidebarInner isMobile={true} />
      </MobileSidebar>

      {/* ===== Main ===== */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex h-9 w-9 items-center cursor-pointer justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50"
              aria-label="Open menu"
            >
              <Icon
                name="iconify:streamline-flex:layout-window-1"
                className="h-5 w-5"
              />
            </button>

            <PageTitle />

            <div className="ml-auto flex items-center gap-2.5">
              {/* Back to user */}
              <button
                onClick={() => nav("/")}
                className="inline-flex items-center gap-2 rounded-xl cursor-pointer border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700  transition-all duration-200 hover:bg-zinc-50 "
              >
                <Icon
                  name="iconify:ooui:new-window-ltr"
                  className="h-4 w-4"
                />
                <span className="hidden sm:inline">Back to User</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6">
          <UserRouteTransition
            transitionKey={loc.pathname}
            routePath={loc.pathname}
            variant="admin"
            minDurationMs={240}
            className="min-h-[60vh]"
          >
            <Outlet />
          </UserRouteTransition>
        </div>

        {/* Footer */}
        <footer className="border-t border-zinc-100 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-zinc-400">
              © {new Date().getFullYear()} HeroSMS • Admin Panel
            </p>
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1">
                <Icon
                  name="iconify:solar:shield-check-bold-duotone"
                  className="h-3 w-3"
                />
                <span>Secure</span>
              </div>
              <span className="h-3 w-px bg-zinc-200" />
              <div className="flex items-center gap-1">
                <Icon
                  name="iconify:solar:server-bold-duotone"
                  className="h-3 w-3"
                />
                <span>v1.0</span>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Global scrollbar styles */}
      <style>{`
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: #d4d4d8 transparent;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #d4d4d8;
          border-radius: 9999px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: #a1a1aa;
        }
      `}</style>
    </div>
  );
}
