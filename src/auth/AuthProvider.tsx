import React, { createContext, useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  USER_AUTH_EXPIRED_EVENT,
  apiFetch,
  setUserBearerToken,
} from "../lib/api";

const LATEST_NEWS_LOGIN_MARK_KEY = "latest-news-login-mark";
const LATEST_NEWS_SHOWN_MARK_KEY = "latest-news-shown-mark";

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

  function applyRealtimeBalance(nextBalance: unknown) {
    const numeric = Number(nextBalance);
    if (!Number.isFinite(numeric)) return;
    setUser((prev) => {
      if (!prev) return prev;
      if (Number(prev.balance ?? 0) === numeric) return prev;
      return { ...prev, balance: numeric };
    });
  }

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
    if (typeof window !== "undefined") {
      const mark = String(Date.now());
      window.sessionStorage.setItem(LATEST_NEWS_LOGIN_MARK_KEY, mark);
      window.sessionStorage.removeItem(LATEST_NEWS_SHOWN_MARK_KEY);
    }
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
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(LATEST_NEWS_LOGIN_MARK_KEY);
        window.sessionStorage.removeItem(LATEST_NEWS_SHOWN_MARK_KEY);
      }
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

  useEffect(() => {
    if (!user?.id) return;

    const topupsStream = new EventSource(`${API_BASE}/api/topups/stream`, {
      withCredentials: true,
    });
    const numbersStream = new EventSource(`${API_BASE}/api/numbers/stream`, {
      withCredentials: true,
    });

    const onTopupUpdate = (event: Event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data ?? "{}");
        if (payload?.balance !== undefined) {
          applyRealtimeBalance(payload.balance);
        }
      } catch {
        // ignore malformed payload
      }
    };

    const onNumberUpdate = (event: Event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data ?? "{}");
        if (payload?.balance !== undefined) {
          applyRealtimeBalance(payload.balance);
        }
      } catch {
        // ignore malformed payload
      }
    };

    topupsStream.addEventListener("topup_update", onTopupUpdate);
    numbersStream.addEventListener("number_update", onNumberUpdate);

    return () => {
      topupsStream.removeEventListener("topup_update", onTopupUpdate);
      numbersStream.removeEventListener("number_update", onNumberUpdate);
      topupsStream.close();
      numbersStream.close();
    };
  }, [user?.id]);

  const value = useMemo(
    () => ({ user, accessToken, isLoading, login, register, logout, refresh, reloadMe }),
    [user, accessToken, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
