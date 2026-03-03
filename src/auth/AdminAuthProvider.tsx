import React from "react";
import {
  ADMIN_AUTH_EXPIRED_EVENT,
  adminFetch,
  setAdminBearerToken,
} from "../lib/adminApi";

type Admin = { id: string; email: string; name?: string };

type Ctx = {
  admin: Admin | null;
  isLoading: boolean;
  adminLogin: (email: string, password: string, captchaToken?: string) => Promise<void>;
  adminLogout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
};

const AdminAuthContext = React.createContext<Ctx | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = React.useState<Admin | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshAdmin = React.useCallback(async () => {
    try {
      const res = await adminFetch("/admin/auth/me", { method: "GET" });
      const data = await res.json();
      setAdmin(data?.admin ?? null);
    } catch {
      setAdmin(null);
      setAdminBearerToken(null);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      setIsLoading(true);
      await refreshAdmin();
      setIsLoading(false);
    })();
  }, [refreshAdmin]);

  React.useEffect(() => {
    const onExpired = () => {
      const hadActiveAdmin = Boolean(admin);
      setAdmin(null);
      setAdminBearerToken(null);

      if (!hadActiveAdmin || typeof window === "undefined") return;
      if (window.location.pathname !== "/admin/login") {
        const from = `${window.location.pathname}${window.location.search}`;
        const qs = new URLSearchParams({
          reason: "auth-required",
          source: "expired",
          from,
        });
        window.location.replace(`/admin/login?${qs.toString()}`);
      }
    };

    window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, onExpired);
  }, [admin]);

  async function adminLogin(email: string, password: string, captchaToken?: string) {
    const res = await adminFetch("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        ...(captchaToken ? { captchaToken } : {}),
      }),
    });
    const data = await res.json();
    setAdmin(data?.admin ?? null);
    setAdminBearerToken(data?.accessToken ?? null);
  }

  async function adminLogout() {
    try {
      await adminFetch("/admin/auth/logout", { method: "POST" });
    } finally {
      setAdmin(null);
      setAdminBearerToken(null);
    }
  }

  const value: Ctx = {
    admin,
    isLoading,
    adminLogin,
    adminLogout,
    refreshAdmin,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = React.useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
