import { Routes, Route, Navigate } from "react-router-dom";

import { GuestOnly, RequireAuth, HomeGate } from "./auth/guards";
import { RequireAdmin, AdminGuestOnly } from "./auth/adminGuards";
import DashboardLayout from "./layouts/DashboardLayout";
import { UserRouteTransition } from "./components/pageTransition";

// admin
import AdminLayout from "./layouts/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import ProfitRateSettings from "./pages/admin/ProfitRateSettings"
import ServiceCountryCustomPrice from "./pages/admin/ServiceCountryCustomPrice"
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminNews from "./pages/admin/AdminNews";
import AdminWebsiteSettings from "./pages/admin/AdminWebsiteSettings";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

import Overview from "./pages/dashboard/Overview";
import OrderPage from "./pages/dashboard/OrderPage";
import NumbersPage from "./pages/dashboard/NumbersPage";
import DepositPage from "./pages/dashboard/DepositPage";
import PurchaseHistoryPage from "./pages/dashboard/PurchaseHistoryPage";
import BalanceMutationsPage from "./pages/dashboard/BalanceMutationsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="text-sm text-slate-600">Page ini belum dibuat.</div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* =========================
          ADMIN ROUTES
          ========================= */}
      <Route element={<AdminGuestOnly />}>
        <Route path="/admin/login" element={<AdminLogin />} />
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="website" element={<AdminWebsiteSettings />} />
          <Route path="services" element={<ServiceCountryCustomPrice />} />
          <Route path="pricing" element={<ProfitRateSettings />} />
        </Route>
      </Route>

      {/* =========================
          USER ROUTES (punya kamu)
          ========================= */}
      {/* "/" pintar: guest => landing, login => dashboard */}
      <Route
        path="/"
        element={
          <HomeGate
            landing={
              <LandingPage />
            }
            dashboard={<DashboardLayout />} // ✅ layout yang punya <Outlet />
          />
        }
      >
        {/* ✅ PROTECTED dashboard routes */}
        <Route element={<RequireAuth />}>
          <Route index element={<Overview />} />
          <Route path="numbers" element={<NumbersPage />} />
          <Route path="orders" element={<OrderPage />} />
          <Route path="deposit" element={<DepositPage />} />
          <Route path="mutasi-saldo" element={<BalanceMutationsPage />} />
          <Route path="history" element={<PurchaseHistoryPage />} />
          <Route path="otp" element={<ComingSoon title="OTP Inbox" />} />
          <Route path="analytics" element={<ComingSoon title="Analytics" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* auth pages hanya guest */}
      <Route element={<GuestOnly />}>
        <Route
          path="/login"
          element={
            <UserRouteTransition
              transitionKey="login"
              routePath="/login"
              variant="auth"
              minDurationMs={220}
            >
              <Login />
            </UserRouteTransition>
          }
        />
        <Route
          path="/register"
          element={
            <UserRouteTransition
              transitionKey="register"
              routePath="/register"
              variant="auth"
              minDurationMs={220}
            >
              <Register />
            </UserRouteTransition>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <UserRouteTransition
              transitionKey="forgot-password"
              routePath="/forgot-password"
              variant="auth"
              minDurationMs={220}
            >
              <ForgotPassword />
            </UserRouteTransition>
          }
        />
      </Route>

      <Route
        path="/reset-password"
        element={
          <UserRouteTransition
            transitionKey="reset-password"
            routePath="/reset-password"
            variant="auth"
            minDurationMs={220}
          >
            <ResetPassword />
          </UserRouteTransition>
        }
      />

      <Route
        path="/not-found"
        element={
          <UserRouteTransition
            transitionKey="not-found"
            routePath="/not-found"
            variant="auth"
            minDurationMs={180}
          >
            <NotFound />
          </UserRouteTransition>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
