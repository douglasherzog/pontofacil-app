"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getSession } from "@/lib/session";
import { HerzogDeveloperSignature } from "@/components/HerzogDeveloperSignature";

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

async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
  } catch {
    // ignore
  }
}

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [hydrated] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employeeGenero, setEmployeeGenero] = useState<"homem" | "mulher" | null>(null);

  useEffect(() => {
    getSession().then((s) => setRole(s.role));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (role !== "employee") return;

    let active = true;
    fetch("/api/proxy/me", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as { nome?: unknown; genero?: unknown };
      })
      .then((data) => {
        if (!active) return;
        setEmployeeName(typeof data?.nome === "string" ? data.nome : null);
        setEmployeeGenero(data?.genero === "homem" || data?.genero === "mulher" ? data.genero : null);
      })
      .catch(() => {
        if (!active) return;
        setEmployeeName(null);
        setEmployeeGenero(null);
      });

    return () => {
      active = false;
    };
  }, [hydrated, role]);

  useEffect(() => {
    if (!hydrated) return;
    if (role !== "employee") return;
    const allowed = pathname === "/pontos" || pathname.startsWith("/pontos/");
    if (!allowed) {
      router.replace("/pontos");
    }
  }, [hydrated, pathname, role, router]);

  const nav = useMemo(() => {
    const effectiveRole: UserRole | null = hydrated ? role : null;
    const isAdmin = effectiveRole === "admin";
    return isAdmin ? NAV : NAV.filter((i) => i.href === "/pontos");
  }, [hydrated, role]);

  const isEmployee = hydrated && role === "employee";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 text-zinc-900">
      <div
        className={
          "mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 " +
          (isEmployee ? "" : "md:grid-cols-[260px_1fr]")
        }
      >
        {!isEmployee ? (
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
              logout().finally(() => router.replace("/login"));
            }}
            className="mt-6 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Sair
          </button>

          <div className="mt-4">
            <HerzogDeveloperSignature />
          </div>
          </aside>
        ) : null}

        <main className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={isEmployee ? "text-2xl font-extrabold tracking-tight" : "text-xl font-semibold tracking-tight"}>
                  {isEmployee ? (
                    <span className="bg-gradient-to-r from-indigo-700 to-fuchsia-700 bg-clip-text text-transparent">
                      Sistema Fácil de Ponto
                    </span>
                  ) : (
                    title
                  )}
                </h1>
                {!hydrated ? (
                  <div className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700">
                    ...
                  </div>
                ) : role === "admin" ? (
                  <div className="rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-2 py-1 text-[10px] font-semibold text-white">
                    Admin
                  </div>
                ) : null}
              </div>

              {isEmployee ? (
                <div className="text-base font-semibold text-zinc-800">
                  <span>Seja {employeeGenero === "mulher" ? "bem vinda" : "bem vindo"}</span>{" "}
                  {employeeName ? (
                    <span className="bg-gradient-to-r from-indigo-700 to-fuchsia-700 bg-clip-text text-transparent">
                      {employeeName}
                    </span>
                  ) : null}
                  <span>{employeeName ? ", " : "! "}tu é uma benção!</span>
                </div>
              ) : null}

              {!isEmployee ? (
                <div className="text-sm font-medium text-zinc-600/90">
                  <span className="bg-gradient-to-r from-indigo-700 to-fuchsia-700 bg-clip-text text-transparent">Sistema</span>{" "}
                  <span className="text-zinc-600/90">Fácil de Ponto.</span>
                </div>
              ) : null}
            </div>

            {isEmployee ? (
              <button
                type="button"
                onClick={() => {
                  logout().finally(() => router.replace("/login"));
                }}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Sair
              </button>
            ) : null}
          </header>

          <div className="mt-6">{children}</div>

          {isEmployee ? (
            <div className="mt-8">
              <HerzogDeveloperSignature />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
