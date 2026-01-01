"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { login } from "@/lib/auth";
import { env } from "@/lib/env";
import { getToken } from "@/lib/tokenStorage";
import { HerzogDeveloperSignature } from "@/components/HerzogDeveloperSignature";

type UserRole = "admin" | "employee";

function base64UrlDecodeToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const value = searchParams.get("next");
    return value && value.startsWith("/") ? value : "/dashboard";
  }, [searchParams]);

  const [email, setEmail] = useState("admin@local.com");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-rose-600 px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl bg-white/10 p-8 shadow-xl backdrop-blur">
          <div className="text-sm font-semibold tracking-tight">PontoFácil</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Entrar no Admin</h1>
          <p className="mt-2 text-sm text-white/80">
            Use o usuário admin padrão ou suas credenciais. Se algo falhar, confira se a API está rodando em
            <span className="font-semibold"> {env.NEXT_PUBLIC_API_BASE_URL}</span>.
          </p>

          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setError(null);

              const res = await login({ email, password });
              setLoading(false);

              if (!res.ok) {
                setError(res.error);
                return;
              }

              const role = getRoleFromToken(getToken() ?? undefined);
              if (role === "employee") {
                router.replace("/pontos");
                return;
              }

              router.replace(nextPath);
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-white/80">E-mail</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-white/15 px-3 text-sm text-white placeholder:text-white/60 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/40"
                placeholder="ex: admin@empresa.com"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-white/80">Senha</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="h-11 rounded-xl bg-white/15 px-3 text-sm text-white placeholder:text-white/60 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/40"
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <div className="rounded-xl bg-rose-500/20 px-3 py-2 text-sm ring-1 ring-rose-200/30">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-white/90 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-xs text-white/70">
            Primeiro acesso: <span className="font-semibold">admin@local</span> / <span className="font-semibold">admin</span>
          </div>

          <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
            <HerzogDeveloperSignature tone="light" />
          </div>
        </div>
      </div>
    </div>
  );
}
