import { env } from "../env";
import { HttpError } from "./errors";

type TurnstileVerifyResponse = {
  success?: boolean;
  hostname?: string;
  "error-codes"?: string[];
};

function normalizeHost(value: string) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";

  try {
    const withScheme = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .trim()
      .toLowerCase();
  }
}

function parseAllowedHosts(value: string) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => normalizeHost(item))
      .filter(Boolean),
  );
}

export async function verifyTurnstileToken(input: {
  token: string;
  remoteIp?: string;
}) {
  const token = String(input.token ?? "").trim();
  if (!token) throw new HttpError(400, "Captcha wajib diisi.");

  const secret = String(env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!secret) {
    throw new HttpError(
      500,
      "Turnstile belum dikonfigurasi di server. Isi TURNSTILE_SECRET_KEY.",
    );
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (input.remoteIp) form.set("remoteip", input.remoteIp);

  const res = await fetch(env.TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  let data: TurnstileVerifyResponse = {};
  try {
    data = (await res.json()) as TurnstileVerifyResponse;
  } catch {
    data = {};
  }

  if (!res.ok || !data.success) {
    throw new HttpError(400, "Verifikasi captcha gagal. Coba lagi.");
  }

  const allowedHosts = parseAllowedHosts(env.TURNSTILE_EXPECTED_HOST ?? "");
  const hostname = normalizeHost(data.hostname ?? "");

  if (allowedHosts.size > 0 && hostname && !allowedHosts.has(hostname)) {
    throw new HttpError(400, "Hostname captcha tidak valid.");
  }
}
