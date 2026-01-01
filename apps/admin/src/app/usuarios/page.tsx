"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/tokenStorage";

type EmployeeOut = {
  id: number;
  email: string;
  nome: string;
  is_active: boolean;
};

export default function UsuariosPage() {
  const [items, setItems] = useState<EmployeeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function load(tokenValue: string | undefined) {
    setLoading(true);
    setError(null);
    const res = await apiRequest<EmployeeOut[]>("/admin/funcionarios", { method: "GET", token: tokenValue });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setItems(res.data);
  }

  useEffect(() => {
    setHydrated(true);
    setToken(getToken() ?? undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      setLoading(false);
      setItems([]);
      return;
    }

    load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token]);

  return (
    <AppShell title="Usuários">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold">Criar funcionário</div>
          <div className="mt-1 text-sm text-zinc-600">Crie o usuário que vai bater ponto (role employee).</div>

          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              setError(null);
              setSuccess(null);

              const res = await apiRequest<EmployeeOut>("/admin/funcionarios", {
                method: "POST",
                token,
                body: JSON.stringify({ nome, email, password }),
              });

              setCreating(false);

              if (!res.ok) {
                setError(res.error);
                return;
              }

              setNome("");
              setEmail("");
              setPassword("");
              setSuccess(`Funcionário criado: ${res.data.email}`);
              await load(token);
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-700">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Ex: João da Silva"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-700">E-mail</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="ex: joao@empresa.com"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-700">Senha</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="mínimo 4 caracteres"
                required
              />
            </div>

            {error ? (
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
            ) : null}
            {success ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={creating || !hydrated || !token}
              className="mt-1 h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
            >
              {creating ? "Criando..." : "Criar"}
            </button>

            {!token ? (
              <div className="text-xs text-zinc-600">Você precisa estar logado como admin para criar usuários.</div>
            ) : null}
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Funcionários</div>
              <div className="mt-1 text-sm text-zinc-600">Lista dos últimos cadastrados.</div>
            </div>
            <button
              type="button"
              onClick={() => load(token)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Atualizar
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-zinc-600">
                      Carregando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-zinc-600">
                      Nenhum funcionário ainda.
                    </td>
                  </tr>
                ) : (
                  items.map((u) => (
                    <tr key={u.id} className="border-t border-zinc-100">
                      <td className="px-3 py-2 font-medium text-zinc-900">{u.nome}</td>
                      <td className="px-3 py-2 text-zinc-700">{u.email}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            "inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 " +
                            (u.is_active
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200")
                          }
                        >
                          {u.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
