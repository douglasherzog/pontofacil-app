"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import { formatDateTimeSP } from "@/lib/dateFormat";
import { getSession } from "@/lib/session";

type EmployeeOut = {
  id: number;
  email: string;
  nome: string;
  is_active: boolean;
};

type PontoAdminAuditAction = "create" | "update" | "delete";

type PontoAdminAuditOut = {
  id: number;
  action: PontoAdminAuditAction;
  ponto_id: number | null;
  employee_user_id: number;
  employee_email: string;
  employee_nome: string;
  admin_user_id: number;
  admin_email: string;
  motivo: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

type PontoAdminAuditPageOut = {
  items: PontoAdminAuditOut[];
  next_cursor: string | null;
};

function actionLabel(a: PontoAdminAuditAction): string {
  if (a === "create") return "criou";
  if (a === "update") return "alterou";
  return "removeu";
}

export default function AuditoriaPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [start, setStart] = useState<string>(today);
  const [end, setEnd] = useState<string>(today);
  const [limit, setLimit] = useState<string>("200");

  const [action, setAction] = useState<PontoAdminAuditAction | "">("");
  const [motivoContains, setMotivoContains] = useState<string>("");
  const [pontoId, setPontoId] = useState<string>("");

  const [items, setItems] = useState<PontoAdminAuditOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<PontoAdminAuditOut | null>(null);

  async function loadEmployees(admin: boolean) {
    if (!admin) return;
    const res = await apiRequest<EmployeeOut[]>("/admin/funcionarios", { method: "GET" });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEmployees(res.data);
  }

  async function loadAudit(admin: boolean, mode: "reset" | "more" = "reset") {
    if (!admin) return;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (employeeId !== "") qs.set("user_id", String(employeeId));
    if (action) qs.set("action", action);
    if (pontoId.trim()) qs.set("ponto_id", pontoId.trim());
    if (motivoContains.trim()) qs.set("motivo_contains", motivoContains.trim());
    if (start) qs.set("start", start);
    if (end) qs.set("end", end);
    if (limit) qs.set("limit", limit);

    if (mode === "more" && nextCursor) {
      qs.set("cursor", nextCursor);
    }

    const res = await apiRequest<PontoAdminAuditPageOut>(`/admin/pontos/audit?${qs.toString()}`, { method: "GET" });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    if (mode === "more") {
      setItems((prev) => [...prev, ...res.data.items]);
    } else {
      setItems(res.data.items);
    }
    setNextCursor(res.data.next_cursor);
  }

  useEffect(() => {
    getSession().then((s) => {
      const admin = s.role === "admin";
      setIsAdmin(admin);
      if (!admin) return;
      loadEmployees(admin);
      loadAudit(admin, "reset");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Auditoria">
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold">Auditoria de correções de ponto</div>
          <div className="mt-1 text-sm text-zinc-600">Registra quando o administrador criou, alterou ou removeu pontos e o motivo informado.</div>

          <div className="mt-5 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Início</label>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Ação</label>
                <select
                  value={action}
                  onChange={(e) => setAction((e.target.value as PontoAdminAuditAction) || "")}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Todas</option>
                  <option value="create">Criação</option>
                  <option value="update">Alteração</option>
                  <option value="delete">Remoção</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Fim</label>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Funcionário (opcional)</label>
                <select
                  value={employeeId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmployeeId(v ? Number(v) : "");
                  }}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Todos</option>
                  {employees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Ponto ID</label>
                <input
                  value={pontoId}
                  onChange={(e) => setPontoId(e.target.value)}
                  inputMode="numeric"
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="ex: 123"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Motivo contém</label>
                <input
                  value={motivoContains}
                  onChange={(e) => setMotivoContains(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="ex: esqueceu"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Limite</label>
                <input
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="200"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadAudit(isAdmin, "reset")}
                disabled={!isAdmin || loading}
                className="h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
              >
                {loading ? "Carregando..." : "Atualizar"}
              </button>
              <button
                type="button"
                onClick={() => loadAudit(isAdmin, "more")}
                disabled={!isAdmin || loading || !nextCursor}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Carregar mais
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmployeeId("");
                  setAction("");
                  setPontoId("");
                  setMotivoContains("");
                  setStart(today);
                  setEnd(today);
                  setLimit("200");
                  setNextCursor(null);
                  setItems([]);
                }}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Limpar filtros
              </button>
              {!isAdmin ? <div className="text-xs text-zinc-600">Você precisa estar logado como admin.</div> : null}
            </div>

            {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div> : null}

            <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                  <tr>
                    <th className="px-3 py-2">Quando</th>
                    <th className="px-3 py-2">Ação</th>
                    <th className="px-3 py-2">Funcionário</th>
                    <th className="px-3 py-2">Motivo</th>
                    <th className="px-3 py-2">Ponto</th>
                    <th className="px-3 py-2 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-zinc-600">
                        Carregando...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-zinc-600">
                        Sem eventos.
                      </td>
                    </tr>
                  ) : (
                    items.map((a) => (
                      <tr key={a.id} className="border-t border-zinc-100">
                        <td className="px-3 py-2 text-zinc-800">{formatDateTimeSP(a.created_at)}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-900">{actionLabel(a.action)}</td>
                        <td className="px-3 py-2 text-zinc-800">{a.employee_nome}</td>
                        <td className="px-3 py-2 text-zinc-700">
                          <div className="max-w-[520px] truncate">{a.motivo}</div>
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{a.ponto_id ?? "-"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setModalItem(a);
                              setModalOpen(true);
                            }}
                            className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && modalItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Evento #{modalItem.id}</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {formatDateTimeSP(modalItem.created_at)} — {actionLabel(modalItem.action)} — {modalItem.employee_nome}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900">
                <div className="text-xs font-semibold text-zinc-600">Motivo</div>
                <div className="mt-1 whitespace-pre-wrap">{modalItem.motivo}</div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div className="text-xs font-semibold text-zinc-600">Antes</div>
                  <pre className="mt-2 max-h-[320px] overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 ring-1 ring-zinc-200">
                    {JSON.stringify(modalItem.before, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div className="text-xs font-semibold text-zinc-600">Depois</div>
                  <pre className="mt-2 max-h-[320px] overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 ring-1 ring-zinc-200">
                    {JSON.stringify(modalItem.after, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="text-xs text-zinc-600">Admin: {modalItem.admin_email}</div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
