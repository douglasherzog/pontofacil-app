import { env } from "./env";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<ApiResult<T>> {
  const url = new URL(path, env.NEXT_PUBLIC_API_BASE_URL).toString();
  const timeoutMs = 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
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
    const detail = typeof json === "object" && json && "detail" in json ? (json as any).detail : undefined;
    const message = typeof detail === "string" ? detail : "Erro ao comunicar com a API";
    return { ok: false, error: message, status: res.status };
  }

  return { ok: true, data: (json as T) ?? (undefined as T) };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
