import { env } from "../env";
import { HttpError } from "./errors";

type TurnstileVerifyResponse = {
  success?: boolean;
  hostname?: string;
  "error-codes"?: string[];
};

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

  const expectedHost = String(env.TURNSTILE_EXPECTED_HOST ?? "").trim().toLowerCase();
  const hostname = String(data.hostname ?? "").trim().toLowerCase();
  if (expectedHost && hostname && hostname !== expectedHost) {
    throw new HttpError(400, "Hostname captcha tidak valid.");
  }
}

