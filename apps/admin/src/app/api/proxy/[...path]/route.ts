import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

const TOKEN_COOKIE_NAME = "pf_token";

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}

export async function PUT(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const params = await ctx.params;
  const token = (await cookies()).get(TOKEN_COOKIE_NAME)?.value;

  const upstreamUrl = new URL("/" + params.path.join("/"), env.NEXT_PUBLIC_API_BASE_URL);
  const incomingUrl = new URL(req.url);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("cookie");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("authorization");
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: `Falha ao conectar na API (${env.NEXT_PUBLIC_API_BASE_URL}). Verifique se ela está rodando.` }, { status: 502 });
  }

  const resHeaders = new Headers(upstreamRes.headers);
  resHeaders.delete("set-cookie");

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}
