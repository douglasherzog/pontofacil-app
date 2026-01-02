import { env } from "./env";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

const DEVICE_ID_STORAGE_KEY = "pf_device_id";

export function getDeviceId(): string | null {
  return getOrCreateDeviceId();
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<ApiResult<T>> {
  const url = options.token
    ? new URL(path, env.NEXT_PUBLIC_API_BASE_URL).toString()
    : new URL(`/api/proxy${path.startsWith("/") ? "" : "/"}${path}`, typeof window === "undefined" ? "http://localhost" : window.location.origin).toString();
  const timeoutMs = 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const deviceId = getOrCreateDeviceId();
  if (deviceId) {
    headers.set("X-Device-Id", deviceId);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      error: `Falha ao conectar na API (${env.NEXT_PUBLIC_API_BASE_URL}). Verifique se ela está rodando.`,
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  const json = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    const detail = getDetail(json);
    const message = typeof detail === "string" ? detail : "Erro ao comunicar com a API";
    return { ok: false, error: message, status: res.status };
  }

  return { ok: true, data: (json as T) ?? (undefined as T) };
}

function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;

    const id = typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : `web_${Date.now()}_${Math.random()}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getDetail(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  if (!("detail" in value)) return undefined;
  return (value as { detail?: unknown }).detail;
}
