"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import { getSession } from "@/lib/session";

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("carregando");
  const [role, setRole] = useState<"admin" | "employee" | null>(null);
  const isAdmin = role === "admin";

  useEffect(() => {
    const run = async () => {
      const session = await getSession();
      setRole(session.role);
      if (session.role === "employee") {
        router.replace("/pontos");
        return;
      }

      const res = await apiRequest<unknown>("/openapi.json", { method: "GET" });
      setStatus(res.ok ? "API ok" : "Falha ao acessar API");
    };

    run();
  }, [router]);

  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-xs font-semibold text-zinc-600">Status</div>
          <div className="mt-2 text-lg font-semibold">{status}</div>
          <div className="mt-1 text-sm text-zinc-600">
            Aqui você vai acompanhar indicadores (usuários, pontos do dia, alertas de inconsistência, etc.).
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-xs font-semibold text-zinc-600">Atalhos</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {isAdmin ? (
              <a className="rounded-xl bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100" href="/usuarios">
                Gerenciar usuários
              </a>
            ) : null}
            <a className="rounded-xl bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100" href="/pontos">
              Ver pontos
            </a>
            {isAdmin ? (
              <a className="rounded-xl bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100" href="/relatorios">
                Gerar relatório
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
