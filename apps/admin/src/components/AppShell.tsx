"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { clearToken } from "@/lib/tokenStorage";
import { getToken } from "@/lib/tokenStorage";

type NavItem = { href: string; label: string };

type UserRole = "admin" | "employee";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/usuarios", label: "Usuários" },
  { href: "/pontos", label: "Pontos" },
  { href: "/auditoria", label: "Auditoria" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/configuracoes", label: "Configurações" },
];

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

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    setHydrated(true);
    setRole(getRoleFromToken(getToken() ?? undefined));
  }, []);

  const nav = useMemo(() => {
    const effectiveRole: UserRole | null = hydrated ? role : null;
    const isAdmin = effectiveRole === "admin";
    return isAdmin ? NAV : NAV.filter((i) => i.href === "/dashboard" || i.href === "/pontos");
  }, [hydrated, role]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 text-zinc-900">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold tracking-tight">PontoFácil</div>
            {!hydrated ? (
              <div className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700">
                ...
              </div>
            ) : role === "admin" ? (
              <div className="rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-2 py-1 text-[10px] font-semibold text-white">
                Admin
              </div>
            ) : (
              <div className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700">
                Funcionário
              </div>
            )}
          </div>

          <nav className="mt-6 flex flex-col gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "rounded-xl px-3 py-2 text-sm transition " +
                    (active
                      ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow"
                      : "text-zinc-700 hover:bg-zinc-100")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
            className="mt-6 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Sair
          </button>
        </aside>

        <main className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <div className="text-xs text-zinc-600">Usabilidade primeiro. Dados oficiais: API FastAPI.</div>
          </header>

          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
