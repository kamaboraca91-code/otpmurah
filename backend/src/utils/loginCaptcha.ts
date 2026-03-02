import { ipKeyGenerator } from "express-rate-limit";

type LoginCaptchaScope = "user" | "admin";

type LoginFailureEntry = {
  failureCount: number;
  lastFailureAt: number;
  captchaRequired: boolean;
};

const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const loginFailureStore = new Map<string, LoginFailureEntry>();

function normalizeEmail(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeIp(value?: string | null) {
  return ipKeyGenerator(String(value ?? ""));
}

function toStoreKey(input: {
  scope: LoginCaptchaScope;
  email: string;
  ip?: string | null;
}) {
  const email = normalizeEmail(input.email) || "unknown";
  const ip = normalizeIp(input.ip);
  return `${input.scope}:${ip}:${email}`;
}

function getValidEntry(key: string) {
  const current = loginFailureStore.get(key);
  if (!current) return null;

  const now = Date.now();
  if (now - current.lastFailureAt > FAILURE_WINDOW_MS) {
    loginFailureStore.delete(key);
    return null;
  }

  return current;
}

export function getLoginCaptchaKey(input: {
  scope: LoginCaptchaScope;
  email: string;
  ip?: string | null;
}) {
  return toStoreKey(input);
}

export function isLoginCaptchaRequired(loginKey: string) {
  return Boolean(getValidEntry(loginKey)?.captchaRequired);
}

export function markLoginFailure(loginKey: string) {
  const now = Date.now();
  const current = getValidEntry(loginKey);

  if (!current) {
    loginFailureStore.set(loginKey, {
      failureCount: 1,
      lastFailureAt: now,
      captchaRequired: false,
    });
    return false;
  }

  current.failureCount += 1;
  current.lastFailureAt = now;
  if (current.failureCount >= FAILURE_THRESHOLD) {
    current.captchaRequired = true;
  }
  loginFailureStore.set(loginKey, current);
  return current.captchaRequired;
}

export function clearLoginFailures(loginKey: string) {
  loginFailureStore.delete(loginKey);
}

