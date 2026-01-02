import { ApiResult } from "./api";

export type LoginPayload = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type?: string;
};

export async function login(payload: LoginPayload) {
  let res: Response;
  try {
    res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Falha ao conectar. Verifique se o Admin está rodando." } satisfies ApiResult<unknown>;
  }

  const json = (await res.json().catch(() => undefined)) as unknown;
  if (!res.ok) {
    const message = getErrorMessage(json) ?? "Erro ao comunicar com a API";
    return { ok: false, error: message, status: res.status } satisfies ApiResult<unknown>;
  }

  return { ok: true, data: { access_token: "" } as TokenResponse } satisfies ApiResult<TokenResponse>;
}

function getErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (!("error" in value)) return null;
  const err = (value as { error?: unknown }).error;
  return typeof err === "string" ? err : null;
}
