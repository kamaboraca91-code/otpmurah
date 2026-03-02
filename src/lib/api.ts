import { getCookie } from "./cookies";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
export const USER_AUTH_EXPIRED_EVENT = "user-auth-expired";

type Json = Record<string, any>;

async function safeJson(res: Response): Promise<Json> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

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
