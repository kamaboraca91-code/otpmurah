import React, { createContext, useEffect, useMemo, useState } from "react";
import {
  USER_AUTH_EXPIRED_EVENT,
  apiFetch,
  setUserBearerToken,
} from "../lib/api";

type User = { id: string; email: string; name?: string | null; balance?: number };
type AuthState = {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string | undefined,
    verificationCode: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  reloadMe: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    const data = await apiFetch("/auth/refresh", { method: "POST" });
    setUser(data.user);
    setAccessToken(data.accessToken);
    setUserBearerToken(data.accessToken ?? null);
  }

  async function login(email: string, password: string, captchaToken?: string) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        ...(captchaToken ? { captchaToken } : {}),
      }),
    });
    setUser(data.user);
    setAccessToken(data.accessToken);
    setUserBearerToken(data.accessToken ?? null);
  }

  async function register(
    email: string,
    password: string,
    name: string | undefined,
    verificationCode: string,
  ) {
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, verificationCode }),
    });
    // optional: auto-login setelah register
    await login(email, password);
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setAccessToken(null);
      setUserBearerToken(null);
    }
  }

  async function reloadMe() {
    const data = await apiFetch("/user/me", { method: "GET" });
    setUser(data?.user ?? null);
  }

  // Re-hydrate session on first load
  useEffect(() => {
    (async () => {
      try {
        await reloadMe();
      } catch {
        setUser(null);
        setAccessToken(null);
        setUserBearerToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onExpired = async () => {
      const hadActiveUser = Boolean(user);

      setUser(null);
      setAccessToken(null);
      setUserBearerToken(null);

      if (!hadActiveUser || typeof window === "undefined") return;
      if (window.location.pathname !== "/login") {
        const from = `${window.location.pathname}${window.location.search}`;
        const qs = new URLSearchParams({
          reason: "auth-required",
          source: "expired",
          from,
        });
        window.location.replace(`/login?${qs.toString()}`);
      }
    };

    window.addEventListener(USER_AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(USER_AUTH_EXPIRED_EVENT, onExpired);
  }, [user]);

  const value = useMemo(
    () => ({ user, accessToken, isLoading, login, register, logout, refresh, reloadMe }),
    [user, accessToken, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
