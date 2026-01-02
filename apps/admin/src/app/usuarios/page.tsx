"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import { getSession } from "@/lib/session";

type EmployeeOut = {
  id: number;
  email: string;
  nome: string;
  genero: EmployeeGenero | null;
  is_active: boolean;
};

type EmployeeGenero = "homem" | "mulher";

type EmployeeDeviceOut = {
  device_id: string;
  device_name: string | null;
  created_at: string;
};

export default function UsuariosPage() {
  const [items, setItems] = useState<EmployeeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editEmployee, setEditEmployee] = useState<EmployeeOut | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGenero, setEditGenero] = useState<EmployeeGenero>("homem");
  const [editPassword, setEditPassword] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<EmployeeOut | null>(null);

  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingEmployee, setPairingEmployee] = useState<EmployeeOut | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [pairingQrDataUrl, setPairingQrDataUrl] = useState<string | null>(null);
  const [pairingDevice, setPairingDevice] = useState<EmployeeDeviceOut | null>(null);
  const [pairingDeviceLoading, setPairingDeviceLoading] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [genero, setGenero] = useState<EmployeeGenero>("homem");

  function openEdit(employee: EmployeeOut) {
    setEditEmployee(employee);
    setEditNome(employee.nome);
    setEditEmail(employee.email);
    setEditGenero(employee.genero ?? "homem");
    setEditPassword("");
    setEditError(null);
    setEditOpen(true);
  }

  function openDelete(employee: EmployeeOut) {
    setDeleteEmployee(employee);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function openPairing(employee: EmployeeOut) {
    setPairingEmployee(employee);
    setPairingOpen(true);
    setPairingError(null);
    setPairingCode(null);
    setPairingExpiresAt(null);
    setPairingQrDataUrl(null);
    setPairingDevice(null);
    setPairingDeviceLoading(true);

    const deviceRes = await apiRequest<EmployeeDeviceOut | null>(
      `/admin/funcionarios/${encodeURIComponent(String(employee.id))}/device`,
      { method: "GET" }
    );
    setPairingDeviceLoading(false);
    if (!deviceRes.ok) {
      setPairingError(deviceRes.error);
      return;
    }
    setPairingDevice(deviceRes.data);
  }

  async function revokePairingDevice() {
    if (!pairingEmployee) return;
    setPairingLoading(true);
    setPairingError(null);
    const res = await apiRequest<{ ok: boolean; revoked: boolean }>(
      `/admin/funcionarios/${encodeURIComponent(String(pairingEmployee.id))}/device/revoke`,
      { method: "POST" }
    );
    setPairingLoading(false);
    if (!res.ok) {
      setPairingError(res.error);
      return;
    }
    setPairingDevice(null);
    setPairingCode(null);
    setPairingExpiresAt(null);
    setPairingQrDataUrl(null);
  }

  async function generatePairingCode() {
    if (!pairingEmployee) return;
    if (pairingDevice) {
      setPairingError("Revogue o dispositivo atual antes de gerar um novo código de par.");
      return;
    }
    setPairingLoading(true);
    setPairingError(null);
    setPairingCode(null);
    setPairingExpiresAt(null);
    setPairingQrDataUrl(null);

    const res = await apiRequest<{ code: string; expires_at: string }>(
      `/admin/funcionarios/${encodeURIComponent(String(pairingEmployee.id))}/device-pairing-code`,
      { method: "POST" }
    );
    setPairingLoading(false);
    if (!res.ok) {
      setPairingError(res.error);
      return;
    }
    setPairingCode(res.data.code);
    setPairingExpiresAt(res.data.expires_at);

    try {
      const QRCode = (await import("qrcode")).default;
      const qrPayload = `PFPAIR:${res.data.code}`;
      const dataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: "M", margin: 1, scale: 6 });
      setPairingQrDataUrl(dataUrl);
    } catch {
      setPairingQrDataUrl(null);
    }
  }

  async function load(enabled: boolean) {
    setLoading(true);
    setError(null);
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }

    const res = await apiRequest<EmployeeOut[]>("/admin/funcionarios", { method: "GET" });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setItems(res.data);
  }

  useEffect(() => {
    let active = true;
    getSession().then((s) => {
      if (!active) return;
      const admin = s.role === "admin";
      setIsAdmin(admin);
      void load(admin);
    });
    return () => {
      active = false;
    };
  }, []);

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
                body: JSON.stringify({ nome, email, password, genero }),
              });

              setCreating(false);

              if (!res.ok) {
                setError(res.error);
                return;
              }

              setNome("");
              setEmail("");
              setPassword("");
              setGenero("homem");
              setSuccess(`Funcionário criado: ${res.data.email}`);
              await load(isAdmin);
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

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-700">Gênero</label>
              <select
                value={genero}
                onChange={(e) => setGenero(e.target.value as EmployeeGenero)}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="homem">Homem</option>
                <option value="mulher">Mulher</option>
              </select>
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
              disabled={creating || !isAdmin}
              className="mt-1 h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
            >
              {creating ? "Criando..." : "Criar"}
            </button>

            {!isAdmin ? (
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
              onClick={() => load(isAdmin)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Atualizar
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200">
            <div className="w-full overflow-x-auto">
              <table className="min-w-[680px] w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">E-mail</th>
                    <th className="px-3 py-2">Gênero</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-zinc-600">
                        Carregando...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-zinc-600">
                        Nenhum funcionário ainda.
                      </td>
                    </tr>
                  ) : (
                    items.map((u) => (
                      <tr key={u.id} className="border-t border-zinc-100">
                        <td className="px-3 py-2 font-medium text-zinc-900">{u.nome}</td>
                        <td className="px-3 py-2 text-zinc-700">{u.email}</td>
                        <td className="px-3 py-2 text-zinc-700">{u.genero === "mulher" ? "Mulher" : "Homem"}</td>
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
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => openPairing(u)}
                              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                            >
                              Dispositivo
                            </button>
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => openEdit(u)}
                              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => openDelete(u)}
                              className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            >
                              Excluir
                            </button>
                          </div>
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

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Editar funcionário</div>
                <div className="mt-1 text-sm text-zinc-600">Atualize os dados do funcionário.</div>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>

            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editEmployee) return;
                setEditLoading(true);
                setEditError(null);

                const payload = {
                  nome: editNome,
                  email: editEmail,
                  genero: editGenero,
                  password: editPassword.trim() ? editPassword : null,
                };
                const res = await apiRequest<EmployeeOut>(`/admin/funcionarios/${encodeURIComponent(String(editEmployee.id))}`, {
                  method: "PUT",
                  body: JSON.stringify(payload),
                });
                setEditLoading(false);
                if (!res.ok) {
                  setEditError(res.error);
                  return;
                }
                setEditOpen(false);
                setSuccess("Funcionário atualizado.");
                await load(isAdmin);
              }}
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Nome</label>
                <input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">E-mail</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Gênero</label>
                <select
                  value={editGenero ?? "homem"}
                  onChange={(e) => setEditGenero(e.target.value as EmployeeGenero)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="homem">Homem</option>
                  <option value="mulher">Mulher</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Nova senha (opcional)</label>
                <input
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  type="password"
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="deixe em branco para manter"
                />
              </div>
              {editError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{editError}</div>
              ) : null}
              <button
                type="submit"
                disabled={editLoading}
                className="h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
              >
                {editLoading ? "Salvando..." : "Salvar"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Excluir funcionário</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Isso irá desativar o funcionário e revogar o dispositivo ativo. Os pontos já registrados serão mantidos.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-600">FUNCIONÁRIO</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{deleteEmployee?.nome}</div>
              <div className="text-sm text-zinc-700">{deleteEmployee?.email}</div>
            </div>

            {deleteError ? (
              <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{deleteError}</div>
            ) : null}

            <button
              type="button"
              onClick={async () => {
                if (!deleteEmployee) return;
                setDeleteLoading(true);
                setDeleteError(null);
                const res = await apiRequest<{ ok: boolean; deactivated: boolean }>(
                  `/admin/funcionarios/${encodeURIComponent(String(deleteEmployee.id))}`,
                  { method: "DELETE" }
                );
                setDeleteLoading(false);
                if (!res.ok) {
                  setDeleteError(res.error);
                  return;
                }
                setDeleteOpen(false);
                setSuccess("Funcionário desativado.");
                await load(isAdmin);
              }}
              disabled={deleteLoading}
              className="mt-4 h-11 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              {deleteLoading ? "Excluindo..." : "Confirmar exclusão"}
            </button>
          </div>
        </div>
      ) : null}

      {pairingOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Código do celular</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Funcionário: <span className="font-semibold">{pairingEmployee?.nome}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPairingOpen(false)}
                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4">
              {pairingDeviceLoading ? <div className="text-sm text-zinc-600">Carregando status do dispositivo...</div> : null}
              {pairingLoading ? <div className="text-sm text-zinc-600">Gerando...</div> : null}
              {pairingError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{pairingError}</div>
              ) : null}

              <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs font-semibold text-zinc-600">DISPOSITIVO ATIVO</div>
                {pairingDevice ? (
                  <div className="mt-2 text-sm text-zinc-700">
                    <div>
                      <span className="font-semibold">ID:</span> <span className="select-all">{pairingDevice.device_id}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Nome:</span> {pairingDevice.device_name ?? "(não informado)"}
                    </div>
                    <div>
                      <span className="font-semibold">Cadastrado em:</span> {pairingDevice.created_at}
                    </div>
                    <button
                      type="button"
                      onClick={() => revokePairingDevice()}
                      disabled={pairingLoading}
                      className="mt-3 h-10 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      {pairingLoading ? "Revogando..." : "Revogar dispositivo"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-zinc-700">Nenhum dispositivo ativo.</div>
                )}
              </div>

              {!pairingDevice ? (
                <button
                  type="button"
                  onClick={() => generatePairingCode()}
                  disabled={pairingLoading || pairingDeviceLoading}
                  className="mt-3 h-11 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
                >
                  {pairingLoading ? "Gerando QR..." : "Gerar QR Code"}
                </button>
              ) : (
                <div className="mt-3 text-xs text-zinc-600">
                  Para cadastrar um novo celular, primeiro revogue o dispositivo atual.
                </div>
              )}

              {pairingCode ? (
                <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-semibold text-zinc-600">CÓDIGO</div>
                  <div className="mt-1 select-all text-2xl font-extrabold tracking-wider text-zinc-900">{pairingCode}</div>
                  {pairingExpiresAt ? <div className="mt-2 text-xs text-zinc-600">Expira em: {pairingExpiresAt}</div> : null}
                  {pairingQrDataUrl ? (
                    <div className="mt-4 flex justify-center">
                      <Image src={pairingQrDataUrl} alt="QR Code de pareamento" width={224} height={224} unoptimized />
                    </div>
                  ) : null}
                  <div className="mt-3 text-xs text-zinc-600">
                    O funcionário deve ler o QR Code no app para liberar o celular.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
