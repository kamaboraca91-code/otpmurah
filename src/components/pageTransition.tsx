import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type TransitionVariant = "dashboard" | "auth" | "admin";

type UserRouteTransitionProps = {
  transitionKey: string;
  routePath?: string;
  children: ReactNode;
  variant?: TransitionVariant;
  minDurationMs?: number;
  className?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeRoutePath(routePath?: string) {
  if (!routePath) return "/";
  const clean = routePath.split("?")[0].split("#")[0];
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean || "/";
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cx("user-skeleton-block", className)} />;
}

function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`stat-${i}`}
          className="rounded-2xl border border-slate-200 bg-white p-4 "
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2.5">
              <SkeletonBlock className="h-2.5 w-16 rounded-md" />
              <SkeletonBlock className="h-7 w-20 rounded-lg" />
            </div>
            <SkeletonBlock className="h-10 w-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-44 rounded-lg" />
        <div className="space-y-2 pt-1">
          {Array.from({ length: rows }).map((_, idx) => (
            <SkeletonBlock key={`table-row-${idx}`} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function OverviewPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200">
        <SkeletonBlock className="h-[210px] rounded-2xl sm:h-[240px] lg:h-[280px]" />
      </div>

      <SkeletonStatCards />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <SkeletonBlock className="h-4 w-44 rounded-lg" />
              <div className="flex gap-2">
                <SkeletonBlock className="h-8 w-16 rounded-lg" />
                <SkeletonBlock className="h-8 w-16 rounded-lg" />
                <SkeletonBlock className="h-8 w-16 rounded-lg" />
              </div>
            </div>
            <SkeletonBlock className="h-[320px] w-full rounded-2xl" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-52 rounded-lg" />
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`overview-news-${idx}`}
                className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
              >
                <div className="space-y-2">
                  <SkeletonBlock className="h-3 w-16 rounded-lg" />
                  <SkeletonBlock className="h-4 w-3/4 rounded-lg" />
                  <SkeletonBlock className="h-3 w-full rounded-lg" />
                  <SkeletonBlock className="h-3 w-5/6 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderPageSkeleton() {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SkeletonBlock className="h-10 w-40 rounded-xl" />
              <SkeletonBlock className="h-9 w-20 rounded-xl" />
            </div>
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={`svc-${idx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-9 w-9 rounded-lg" />
                    <SkeletonBlock className="h-4 flex-1 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-7">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-4">
            <SkeletonBlock className="h-10 w-52 rounded-xl" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={`country-${idx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
                >
                  <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <SkeletonBlock className="h-4 w-36 rounded-lg" />
                      <SkeletonBlock className="h-3 w-24 rounded-lg" />
                    </div>
                    <SkeletonBlock className="h-8 w-20 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumbersPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="space-y-3">
              <SkeletonBlock className="h-8 w-40 rounded-lg" />
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={`num-left-${idx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-32 rounded-lg" />
                    <SkeletonBlock className="h-3 w-48 rounded-lg" />
                    <SkeletonBlock className="h-3 w-28 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="space-y-4">
              <SkeletonBlock className="h-8 w-52 rounded-lg" />
              <div className="grid gap-4 sm:grid-cols-2">
                <SkeletonBlock className="h-28 w-full rounded-2xl" />
                <SkeletonBlock className="h-28 w-full rounded-2xl" />
              </div>
              <SkeletonBlock className="h-16 w-full rounded-xl" />
              <SkeletonBlock className="h-12 w-40 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DepositPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-4">
            <SkeletonBlock className="h-8 w-40 rounded-lg" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <SkeletonBlock key={`chip-${idx}`} className="h-10 rounded-xl" />
              ))}
            </div>
            <SkeletonBlock className="h-12 w-full rounded-xl" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-4">
            <SkeletonBlock className="h-8 w-44 rounded-lg" />
            <div className="flex flex-col gap-4 sm:flex-row">
              <SkeletonBlock className="h-56 w-56 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <SkeletonBlock className="h-10 w-full rounded-xl" />
                <SkeletonBlock className="h-10 w-full rounded-xl" />
                <SkeletonBlock className="h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SkeletonTable rows={8} />
    </div>
  );
}

function BalanceMutationPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`stat-${i}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 "
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2.5">
                <SkeletonBlock className="h-2.5 w-16 rounded-md" />
                <SkeletonBlock className="h-7 w-20 rounded-lg" />
              </div>
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Card Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {/* Header Skeleton */}
        <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-xl" />
              <div className="space-y-1.5">
                <SkeletonBlock className="h-3.5 w-28 rounded-md" />
                <SkeletonBlock className="h-2.5 w-36 rounded-md" />
              </div>
            </div>
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
          </div>
        </div>

        {/* Search & Filters Skeleton */}
        <div className="border-b border-slate-100/80 px-5 py-3">
          <div className="grid gap-2.5 lg:grid-cols-[1fr_180px_180px]">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
          </div>
        </div>

        {/* Table Header Skeleton */}
        <div className="border-b border-slate-100/80 bg-slate-50/40 px-5 py-3">
          <div className="grid grid-cols-6 gap-4">
            {[14, 16, 12, 14, 18, 24].map((w, i) => (
              <SkeletonBlock
                key={`th-${i}`}
                className="h-2.5 rounded-md"

              />
            ))}
          </div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={`row-${idx}`} className="px-5 py-4">
              <div className="grid grid-cols-6 gap-4 items-start">
                {/* Waktu */}
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-3 w-28 rounded-md" />
                  <SkeletonBlock className="h-2.5 w-16 rounded-md" />
                  <SkeletonBlock className="h-4 w-24 rounded-md" />
                </div>
                {/* Tipe */}
                <div className="flex items-center gap-2">
                  <SkeletonBlock className="h-8 w-8 rounded-lg" />
                  <SkeletonBlock className="h-3.5 w-20 rounded-md" />
                </div>
                {/* Arah */}
                <SkeletonBlock className="h-6 w-18 rounded-full" />
                {/* Jumlah */}
                <SkeletonBlock className="h-8 w-28 rounded-lg" />
                {/* Saldo */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <SkeletonBlock className="h-2.5 w-14 rounded-md" />
                    <SkeletonBlock className="h-3 w-20 rounded-md" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <SkeletonBlock className="h-2.5 w-14 rounded-md" />
                    <SkeletonBlock className="h-3 w-20 rounded-md" />
                  </div>
                </div>
                {/* Keterangan */}
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-3 w-36 rounded-md" />
                  <SkeletonBlock className="h-4 w-20 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Skeleton */}
        <div className="border-t border-slate-100/80 bg-slate-50/30 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-40 rounded-md" />
            <div className="flex items-center gap-1">
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
              <SkeletonBlock className="h-8 w-16 rounded-lg" />
              <div className="flex items-center gap-0.5 mx-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBlock key={`pg-${i}`} className="h-8 w-8 rounded-lg" />
                ))}
              </div>
              <SkeletonBlock className="h-8 w-16 rounded-lg" />
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseHistoryPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`stat-${i}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 "
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2.5">
                <SkeletonBlock className="h-2.5 w-16 rounded-md" />
                <SkeletonBlock className="h-7 w-20 rounded-lg" />
              </div>
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Card Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {/* Header Skeleton */}
        <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-xl" />
              <div className="space-y-1.5">
                <SkeletonBlock className="h-3.5 w-32 rounded-md" />
                <SkeletonBlock className="h-2.5 w-24 rounded-md" />
              </div>
            </div>
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
          </div>
        </div>

        {/* Search & Filter Skeleton */}
        <div className="border-b border-slate-100/80 px-5 py-3">
          <div className="grid gap-2.5 sm:grid-cols-[1fr_200px]">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
          </div>
        </div>

        {/* Table Header Skeleton */}
        <div className="border-b border-slate-100/80 bg-slate-50/40 px-5 py-3">
          <div className="grid grid-cols-7 gap-4">
            {[16, 20, 18, 16, 12, 14, 14].map((w, i) => (
              <SkeletonBlock
                key={`th-${i}`}
                className="h-2.5 rounded-md"
              />
            ))}
          </div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={`row-${idx}`} className="px-5 py-4">
              <div className="grid grid-cols-7 gap-4 items-start">
                {/* Waktu */}
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-3 w-28 rounded-md" />
                  <SkeletonBlock className="h-2.5 w-16 rounded-md" />
                  <SkeletonBlock className="h-4 w-24 rounded-md" />
                </div>
                {/* Layanan */}
                <div className="flex items-center gap-2">
                  <SkeletonBlock className="h-8 w-8 rounded-lg" />
                  <SkeletonBlock className="h-3.5 w-16 rounded-md" />
                </div>
                {/* Negara */}
                <div className="flex items-center gap-2">
                  <SkeletonBlock className="h-5 w-5 rounded-full" />
                  <SkeletonBlock className="h-3 w-20 rounded-md" />
                </div>
                {/* Nomor */}
                <SkeletonBlock className="h-8 w-32 rounded-lg" />
                {/* Harga */}
                <SkeletonBlock className="h-6 w-20 rounded-lg" />
                {/* Status */}
                <SkeletonBlock className="h-6 w-24 rounded-full" />
                {/* SMS Code */}
                <SkeletonBlock className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Skeleton */}
        <div className="border-t border-slate-100/80 bg-slate-50/30 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-40 rounded-md" />
            <div className="flex items-center gap-1">
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
              <SkeletonBlock className="h-8 w-16 rounded-lg" />
              <div className="flex items-center gap-0.5 mx-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBlock key={`pg-${i}`} className="h-8 w-8 rounded-lg" />
                ))}
              </div>
              <SkeletonBlock className="h-8 w-16 rounded-lg" />
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="space-y-4">
              <SkeletonBlock className="h-8 w-44 rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-11 w-40 rounded-xl" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="space-y-4">
              <SkeletonBlock className="h-8 w-52 rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-32 w-full rounded-xl" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="space-y-3">
              <SkeletonBlock className="h-8 w-44 rounded-xl" />
              {Array.from({ length: 3 }).map((_, idx) => (
                <SkeletonBlock key={`sess-${idx}`} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardFallbackSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonStatCards />
      <SkeletonTable rows={6} />
    </div>
  );
}

function DashboardPageSkeleton({ routePath }: { routePath: string }) {
  if (routePath === "/") return <OverviewPageSkeleton />;
  if (routePath.startsWith("/orders")) return <OrderPageSkeleton />;
  if (routePath.startsWith("/numbers")) return <NumbersPageSkeleton />;
  if (routePath.startsWith("/deposit")) return <DepositPageSkeleton />;
  if (routePath.startsWith("/mutasi-saldo")) return <BalanceMutationPageSkeleton />;
  if (routePath.startsWith("/history")) return <PurchaseHistoryPageSkeleton />;
  if (routePath.startsWith("/settings")) return <SettingsPageSkeleton />;
  return <DashboardFallbackSkeleton />;
}

function LandingPageSkeleton() {
  return (
    <div className="min-h-screen bg-white px-4 sm:px-6">
      <div className="mx-auto max-w-7xl py-4">
        <div className="flex h-16 items-center justify-between">
          <SkeletonBlock className="h-10 w-44 rounded-xl" />
          <div className="hidden items-center gap-3 lg:flex">
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
          </div>
          <SkeletonBlock className="h-10 w-32 rounded-xl" />
        </div>

        <div className="grid items-center gap-10 py-12 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="flex gap-2">
              <SkeletonBlock className="h-7 w-28 rounded-full" />
              <SkeletonBlock className="h-7 w-28 rounded-full" />
              <SkeletonBlock className="h-7 w-28 rounded-full" />
            </div>
            <SkeletonBlock className="h-12 w-4/5 rounded-xl" />
            <SkeletonBlock className="h-5 w-full rounded-lg" />
            <SkeletonBlock className="h-5 w-11/12 rounded-lg" />
            <div className="flex gap-3 pt-2">
              <SkeletonBlock className="h-10 w-36 rounded-xl" />
              <SkeletonBlock className="h-10 w-36 rounded-xl" />
            </div>
            <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <SkeletonBlock key={`land-stat-${idx}`} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <SkeletonBlock className="h-[540px] w-full rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-5 py-10 sm:px-8 md:px-12">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className="order-2 space-y-4 md:order-1">
          <SkeletonBlock className="h-6 w-56 rounded-full" />
          <SkeletonBlock className="h-10 w-56 rounded-xl" />
          <SkeletonBlock className="h-12 w-4/5 rounded-xl" />
          <SkeletonBlock className="h-4 w-full rounded-lg" />
          <SkeletonBlock className="h-4 w-10/12 rounded-lg" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonBlock key={`login-left-${idx}`} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>

        <div className="order-1 rounded-2xl border border-slate-200 bg-white/80 p-6 md:order-2 sm:p-8">
          <div className="space-y-4">
            <SkeletonBlock className="h-8 w-52 rounded-xl" />
            <SkeletonBlock className="h-4 w-64 rounded-lg" />
            <div className="space-y-3 pt-2">
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
            </div>
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-5 py-10 sm:px-8 md:px-12">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className="order-1 rounded-2xl border border-slate-200 bg-white/80 p-6 sm:p-8">
          <div className="space-y-4">
            <SkeletonBlock className="h-8 w-52 rounded-xl" />
            <SkeletonBlock className="h-4 w-56 rounded-lg" />
            <div className="space-y-3 pt-2">
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
            </div>
            <SkeletonBlock className="h-40 w-full rounded-xl" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </div>
        </div>

        <div className="order-2 space-y-4">
          <SkeletonBlock className="h-6 w-44 rounded-full" />
          <SkeletonBlock className="h-10 w-56 rounded-xl" />
          <SkeletonBlock className="h-12 w-4/5 rounded-xl" />
          <SkeletonBlock className="h-4 w-full rounded-lg" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonBlock key={`reg-right-${idx}`} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <SkeletonBlock className="h-20 rounded-xl" />
            <SkeletonBlock className="h-20 rounded-xl" />
            <SkeletonBlock className="h-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthFallbackSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <SkeletonBlock className="h-12 w-2/3 rounded-xl" />
        <SkeletonBlock className="mt-4 h-4 w-full rounded-lg" />
        <SkeletonBlock className="mt-3 h-4 w-5/6 rounded-lg" />
      </div>
    </div>
  );
}

function AuthPageSkeleton({ routePath }: { routePath: string }) {
  if (routePath === "/") return <LandingPageSkeleton />;
  if (routePath.startsWith("/login")) return <LoginPageSkeleton />;
  if (routePath.startsWith("/register")) return <RegisterPageSkeleton />;
  if (routePath.startsWith("/forgot-password")) return <RegisterPageSkeleton />;
  if (routePath.startsWith("/reset-password")) return <RegisterPageSkeleton />;
  return <AuthFallbackSkeleton />;
}

function AdminStatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`admin-stat-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <SkeletonBlock className="h-2.5 w-20 rounded-md" />
              <SkeletonBlock className="h-7 w-24 rounded-lg" />
            </div>
            <SkeletonBlock className="h-10 w-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminTablePanelSkeleton({
  rows = 7,
  withStats = false,
}: {
  rows?: number;
  withStats?: boolean;
}) {
  return (
    <div className="space-y-6">
      {withStats ? <AdminStatCardsSkeleton /> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-xl" />
              <div className="space-y-1.5">
                <SkeletonBlock className="h-3.5 w-36 rounded-md" />
                <SkeletonBlock className="h-2.5 w-28 rounded-md" />
              </div>
            </div>
            <SkeletonBlock className="h-8 w-24 rounded-lg" />
          </div>
        </div>

        <div className="border-b border-slate-100/80 px-5 py-3">
          <div className="grid gap-2.5 sm:grid-cols-[1fr_180px]">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
          </div>
        </div>

        <div className="divide-y divide-slate-50 px-5 py-3">
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={`admin-row-${idx}`} className="grid items-center gap-4 py-3 sm:grid-cols-5">
              <SkeletonBlock className="h-3.5 rounded-md sm:col-span-2" />
              <SkeletonBlock className="h-3.5 rounded-md" />
              <SkeletonBlock className="h-3.5 rounded-md" />
              <SkeletonBlock className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <AdminStatCardsSkeleton />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-6 w-40 rounded-lg" />
              <div className="flex gap-2">
                <SkeletonBlock className="h-8 w-12 rounded-lg" />
                <SkeletonBlock className="h-8 w-12 rounded-lg" />
                <SkeletonBlock className="h-8 w-12 rounded-lg" />
              </div>
            </div>
          </div>
          <div className="p-5">
            <SkeletonBlock className="h-[300px] w-full rounded-2xl" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <SkeletonBlock className="h-6 w-40 rounded-lg" />
          </div>
          <div className="space-y-4 p-5">
            <div className="flex gap-3">
              <SkeletonBlock className="h-8 w-40 rounded-lg" />
              <SkeletonBlock className="h-8 w-40 rounded-lg" />
            </div>
            <SkeletonBlock className="h-[300px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminWebsiteSkeleton() {
  return (
    <div className="space-y-6">
      <AdminStatCardsSkeleton />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-3">
            <SkeletonBlock className="h-8 w-48 rounded-xl" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <SkeletonBlock className="h-28 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-36 rounded-xl" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-3">
            <SkeletonBlock className="h-8 w-44 rounded-xl" />
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonBlock key={`banner-${idx}`} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminServicePricingSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-3">
            <SkeletonBlock className="h-8 w-40 rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonBlock key={`svc-list-${idx}`} className="h-11 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="xl:col-span-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-3">
            <SkeletonBlock className="h-8 w-56 rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, idx) => (
                <SkeletonBlock key={`country-row-${idx}`} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminFallbackSkeleton() {
  return (
    <div className="space-y-6">
      <AdminStatCardsSkeleton />
      <SkeletonTable rows={6} />
    </div>
  );
}

function AdminPageSkeleton({ routePath }: { routePath: string }) {
  if (routePath === "/admin") return <AdminOverviewSkeleton />;
  if (routePath.startsWith("/admin/orders")) return <AdminTablePanelSkeleton withStats={false} />;
  if (routePath.startsWith("/admin/users")) return <AdminTablePanelSkeleton withStats />;
  if (routePath.startsWith("/admin/news")) return <AdminTablePanelSkeleton withStats />;
  if (routePath.startsWith("/admin/website")) return <AdminWebsiteSkeleton />;
  if (routePath.startsWith("/admin/services")) return <AdminServicePricingSkeleton />;
  if (routePath.startsWith("/admin/pricing")) return <AdminServicePricingSkeleton />;
  return <AdminFallbackSkeleton />;
}

function TransitionSkeleton({
  variant,
  routePath,
}: {
  variant: TransitionVariant;
  routePath: string;
}) {
  if (variant === "dashboard") return <DashboardPageSkeleton routePath={routePath} />;
  if (variant === "admin") return <AdminPageSkeleton routePath={routePath} />;
  return <AuthPageSkeleton routePath={routePath} />;
}

export function UserRouteTransition({
  transitionKey,
  routePath,
  children,
  variant = "dashboard",
  minDurationMs = 220,
  className,
}: UserRouteTransitionProps) {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const normalizedPath = normalizeRoutePath(routePath);

  useEffect(() => {
    setShowSkeleton(true);
    const timer = window.setTimeout(() => {
      setShowSkeleton(false);
    }, Math.max(120, minDurationMs));

    return () => window.clearTimeout(timer);
  }, [transitionKey, minDurationMs]);

  return (
    <div className={cx("min-h-[220px]", className)}>
      {showSkeleton ? (
        <div className="user-route-fade-in">
          <TransitionSkeleton variant={variant} routePath={normalizedPath} />
        </div>
      ) : (
        <div key={transitionKey} className="user-route-enter">
          {children}
        </div>
      )}
    </div>
  );
}

export function UserLoadingScreen({
  variant = "auth",
  routePath,
}: {
  variant?: TransitionVariant;
  routePath?: string;
}) {
  const normalizedPath = normalizeRoutePath(routePath);

  return (
    <div className="user-route-fade-in">
      <TransitionSkeleton variant={variant} routePath={normalizedPath} />
    </div>
  );
}
