import { getCookie } from "./cookies";

function resolveApiBase() {
  const raw = String(import.meta.env.VITE_API_BASE ?? "").trim();
  if (raw) return raw.replace(/\/+$/, "");
  return import.meta.env.PROD ? "" : "http://localhost:4000";
}

export const API_BASE = resolveApiBase();
export const ADMIN_AUTH_EXPIRED_EVENT = "admin-auth-expired";
let adminBearerToken: string | null = null;

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function setAdminBearerToken(token: string | null) {
  adminBearerToken = token && token.trim() ? token.trim() : null;
}

export async function adminFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  } else {
    headers.delete("Content-Type");
  }

  if (path === "/admin/auth/refresh") {
    const csrf = getCookie("adm_csrf");
    if (csrf) headers.set("x-csrf-token", csrf);
  }

  if (adminBearerToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${adminBearerToken}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const body = await safeJson(res);
    if (res.status === 401 && !path.startsWith("/admin/auth/") && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(ADMIN_AUTH_EXPIRED_EVENT, {
          detail: {
            path,
            message: (body as any)?.message || "Autentikasi admin dibutuhkan",
          },
        }),
      );
    }
    const msg = (body as any)?.message ?? `Request failed (${res.status})`;
    const err = new Error(msg) as Error & {
      status?: number;
      data?: any;
      captchaRequired?: boolean;
    };
    err.status = res.status;
    err.data = body;
    if (typeof (body as any)?.captchaRequired === "boolean") {
      err.captchaRequired = (body as any).captchaRequired;
    }
    throw err;
  }

  return res;
}
