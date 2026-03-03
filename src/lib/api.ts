import { getCookie } from "./cookies";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
export const USER_AUTH_EXPIRED_EVENT = "user-auth-expired";
const DEFAULT_REQUEST_TIMEOUT_MS = 25000;
let userBearerToken: string | null = null;

type Json = Record<string, any>;
type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
};

async function safeJson(res: Response): Promise<Json> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function setUserBearerToken(token: string | null) {
  userBearerToken = token && token.trim() ? token.trim() : null;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal, ...fetchOptions } = options;
  const headers = new Headers(options.headers ?? {});
  const isFormData =
    typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  } else {
    headers.delete("Content-Type");
  }

  // Inject CSRF token only for refresh (atau bisa untuk semua POST yang pakai cookie)
  if (path === "/auth/refresh") {
    const csrf = getCookie("csrfToken");
    if (csrf) headers.set("x-csrf-token", csrf);
  }

  // Fallback for mobile browsers that block cross-site cookies.
  if (userBearerToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${userBearerToken}`);
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const relayAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", relayAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      credentials: "include",
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Request timeout. Coba lagi.");
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", relayAbort);
  }

  const data = await safeJson(res);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(USER_AUTH_EXPIRED_EVENT, {
          detail: {
            path,
            message: data?.message || "Autentikasi dibutuhkan",
          },
        }),
      );
    }
    const err = new Error(data?.message || `Request failed: ${res.status}`) as Error & {
      status?: number;
      data?: Json;
      captchaRequired?: boolean;
    };
    err.status = res.status;
    err.data = data;
    if (typeof data?.captchaRequired === "boolean") {
      err.captchaRequired = data.captchaRequired;
    }
    throw err;
  }
  return data;
}
