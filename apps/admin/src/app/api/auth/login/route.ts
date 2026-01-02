import { NextResponse } from "next/server";

import { env } from "@/lib/env";

const TOKEN_COOKIE_NAME = "pf_token";

export async function POST(req: Request) {
  const payload = (await req.json()) as { email?: unknown; password?: unknown };

  const res = await fetch(new URL("/auth/login", env.NEXT_PUBLIC_API_BASE_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  const json = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    const detail = getDetail(json);
    const message = typeof detail === "string" ? detail : "Erro ao comunicar com a API";
    return NextResponse.json({ error: message }, { status: res.status });
  }

  const accessToken = getAccessToken(json);

  if (!accessToken) {
    return NextResponse.json({ error: "Resposta inválida da API" }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOKEN_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
  return response;
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

function getAccessToken(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if (!("access_token" in value)) return "";
  const token = (value as { access_token?: unknown }).access_token;
  return typeof token === "string" ? token : "";
}
