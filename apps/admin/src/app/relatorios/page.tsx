"use client";

import { AppShell } from "@/components/AppShell";

export default function RelatoriosPage() {
  return (
    <AppShell title="Relatórios">
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
        <div className="text-sm font-semibold">Em construção</div>
        <div className="mt-2 text-sm text-zinc-600">
          Aqui teremos: geração de relatório por período, exportação CSV/PDF e auditoria.
        </div>
      </div>
    </AppShell>
  );
}
