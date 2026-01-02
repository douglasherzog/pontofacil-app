import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const TOKEN_COOKIE_NAME = "pf_token";

type UserRole = "admin" | "employee";

export async function GET() {
  const token = (await cookies()).get(TOKEN_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false, role: null });
  }

  const role = getRoleFromToken(token);
  return NextResponse.json({ authenticated: true, role });
}

function getRoleFromToken(token: string | undefined): UserRole | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const json = base64UrlDecodeToString(parts[1]);
    const payload = JSON.parse(json) as { role?: unknown };
    return payload.role === "admin" || payload.role === "employee" ? payload.role : null;
  } catch {
    return null;
  }
}

function base64UrlDecodeToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}
