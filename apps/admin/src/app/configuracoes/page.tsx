"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import { formatDateTimeSP } from "@/lib/dateFormat";
import { getToken } from "@/lib/tokenStorage";

type ConfigLocalOut = {
  local_lat: number;
  local_lng: number;
  raio_m: number;
  updated_at: string;
};

type PontoCorrectionConfigOut = {
  window_days: number;
  updated_at: string;
};

type JornadaValidationConfigOut = {
  intervalo_exige_4_batidas_blocking: boolean;
  updated_at: string;
};

export default function ConfiguracoesPage() {
  const token = useMemo(() => getToken() ?? undefined, []);
  const [current, setCurrent] = useState<ConfigLocalOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [correctionConfig, setCorrectionConfig] = useState<PontoCorrectionConfigOut | null>(null);
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionDays, setCorrectionDays] = useState<string>("30");

  const [jornadaValidationConfig, setJornadaValidationConfig] = useState<JornadaValidationConfigOut | null>(null);
  const [jornadaValidationLoading, setJornadaValidationLoading] = useState(false);
  const [jornadaValidationSaving, setJornadaValidationSaving] = useState(false);
  const [intervalBlocking, setIntervalBlocking] = useState<boolean>(false);

  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [raio, setRaio] = useState<string>("200");

  async function load() {
    setLoading(true);
    setError(null);
    const res = await apiRequest<ConfigLocalOut | null>("/config-local", { method: "GET" });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setCurrent(res.data);
    if (res.data) {
      setLat(String(res.data.local_lat));
      setLng(String(res.data.local_lng));
      setRaio(String(res.data.raio_m));
    }
  }

  async function loadCorrectionConfig() {
    if (!token) return;
    setCorrectionLoading(true);
    const res = await apiRequest<PontoCorrectionConfigOut>("/admin/pontos-correction-config", { method: "GET", token });
    setCorrectionLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setCorrectionConfig(res.data);
    setCorrectionDays(String(res.data.window_days));
  }

  async function loadJornadaValidationConfig() {
    if (!token) return;
    setJornadaValidationLoading(true);
    const res = await apiRequest<JornadaValidationConfigOut>("/admin/jornada-validation-config", { method: "GET", token });
    setJornadaValidationLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setJornadaValidationConfig(res.data);
    setIntervalBlocking(Boolean(res.data.intervalo_exige_4_batidas_blocking));
  }

  function getLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Geolocalização não suportada."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  useEffect(() => {
    load();
    loadCorrectionConfig();
    loadJornadaValidationConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Configurações">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold">Geofence (bloqueio por local)</div>
          <div className="mt-1 text-sm text-zinc-600">
            Quando configurado, a API bloqueia o registro de ponto fora do raio permitido.
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setSuccess(null);
                try {
                  const loc = await getLocation();
                  setLat(String(loc.lat));
                  setLng(String(loc.lng));
                  setSuccess("Localização capturada do navegador. Ajuste o raio e salve.");
                } catch {
                  setError("Não foi possível capturar sua localização. Verifique as permissões do navegador.");
                }
              }}
              className="h-10 w-fit rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Usar minha localização atual
            </button>

            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                setError(null);
                setSuccess(null);

                const local_lat = Number(lat);
                const local_lng = Number(lng);
                const raio_m = Number(raio);

                if (!Number.isFinite(local_lat) || !Number.isFinite(local_lng) || !Number.isFinite(raio_m)) {
                  setSaving(false);
                  setError("Preencha latitude, longitude e raio com valores válidos.");
                  return;
                }

                const res = await apiRequest<ConfigLocalOut>("/admin/config-local", {
                  method: "PUT",
                  token,
                  body: JSON.stringify({ local_lat, local_lng, raio_m }),
                });

                setSaving(false);

                if (!res.ok) {
                  setError(res.error);
                  return;
                }

                setCurrent(res.data);
                setSuccess("Configuração salva. A partir de agora, batidas fora do raio serão bloqueadas com advertência.");
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-700">Latitude</label>
                  <input
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="ex: -23.55052"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-700">Longitude</label>
                  <input
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="ex: -46.63331"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-700">Raio permitido (metros)</label>
                <input
                  value={raio}
                  onChange={(e) => setRaio(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="ex: 200"
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || !token}
                  className="h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => load()}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Recarregar
                </button>
              </div>

              {!token ? (
                <div className="text-xs text-zinc-600">Você precisa estar logado como admin para salvar.</div>
              ) : null}
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Configuração atual</div>
              <div className="mt-1 text-sm text-zinc-600">O que está salvo na API agora.</div>
            </div>
            <button
              type="button"
              onClick={() => load()}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Atualizar
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            {loading ? (
              <div className="text-zinc-600">Carregando...</div>
            ) : current ? (
              <div className="grid grid-cols-1 gap-1">
                <div>
                  <span className="text-zinc-600">Latitude:</span> {current.local_lat}
                </div>
                <div>
                  <span className="text-zinc-600">Longitude:</span> {current.local_lng}
                </div>
                <div>
                  <span className="text-zinc-600">Raio:</span> {current.raio_m}m
                </div>
                <div>
                  <span className="text-zinc-600">Atualizado em:</span> {formatDateTimeSP(current.updated_at)}
                </div>
              </div>
            ) : (
              <div className="text-zinc-600">Ainda não configurado.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Janela de correção de pontos</div>
              <div className="mt-1 text-sm text-zinc-600">Define por quantos dias o admin pode corrigir pontos.</div>
            </div>
            <button
              type="button"
              onClick={() => loadCorrectionConfig()}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              disabled={!token || correctionLoading}
            >
              {correctionLoading ? "Carregando..." : "Atualizar"}
            </button>
          </div>

          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!token) return;
              setCorrectionSaving(true);
              setError(null);
              setSuccess(null);

              const window_days = Number(correctionDays);
              if (!Number.isFinite(window_days) || window_days <= 0) {
                setCorrectionSaving(false);
                setError("Informe um número de dias válido (maior que 0). ");
                return;
              }

              const res = await apiRequest<PontoCorrectionConfigOut>("/admin/pontos-correction-config", {
                method: "PUT",
                token,
                body: JSON.stringify({ window_days }),
              });

              setCorrectionSaving(false);

              if (!res.ok) {
                setError(res.error);
                return;
              }

              setCorrectionConfig(res.data);
              setCorrectionDays(String(res.data.window_days));
              setSuccess("Janela de correção atualizada.");
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-700">Dias (padrão 30)</label>
              <input
                value={correctionDays}
                onChange={(e) => setCorrectionDays(e.target.value)}
                className="h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="30"
                required
              />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
              {correctionConfig ? (
                <div className="grid grid-cols-1 gap-1">
                  <div>
                    <span className="text-zinc-600">Janela atual:</span> {correctionConfig.window_days} dias
                  </div>
                  <div>
                    <span className="text-zinc-600">Atualizado em:</span> {formatDateTimeSP(correctionConfig.updated_at)}
                  </div>
                </div>
              ) : (
                <div className="text-zinc-600">Ainda não carregado.</div>
              )}
            </div>

            {error ? (
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
            ) : null}
            {success ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{success}</div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!token || correctionSaving}
                className="h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
              >
                {correctionSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>

            {!token ? <div className="text-xs text-zinc-600">Você precisa estar logado como admin para salvar.</div> : null}
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Validação da Jornada</div>
              <div className="mt-1 text-sm text-zinc-600">
                Controla se inconsistências bloqueiam o retorno da jornada. Ex.: se houver intervalo, exigir exatamente 4 batidas.
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadJornadaValidationConfig()}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              disabled={!token || jornadaValidationLoading}
            >
              {jornadaValidationLoading ? "Carregando..." : "Atualizar"}
            </button>
          </div>

          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!token) return;
              setJornadaValidationSaving(true);
              setError(null);
              setSuccess(null);

              const res = await apiRequest<JornadaValidationConfigOut>("/admin/jornada-validation-config", {
                method: "PUT",
                token,
                body: JSON.stringify({ intervalo_exige_4_batidas_blocking: Boolean(intervalBlocking) }),
              });

              setJornadaValidationSaving(false);

              if (!res.ok) {
                setError(res.error);
                return;
              }

              setJornadaValidationConfig(res.data);
              setIntervalBlocking(Boolean(res.data.intervalo_exige_4_batidas_blocking));
              setSuccess("Configuração de validação da jornada atualizada.");
            }}
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-700">Bloquear se houver intervalo sem exatamente 4 batidas</label>
              <button
                type="button"
                onClick={() => setIntervalBlocking((v) => !v)}
                disabled={!token || jornadaValidationSaving}
                className={
                  "h-11 w-fit rounded-xl px-4 text-sm font-semibold shadow disabled:opacity-60 " +
                  (intervalBlocking
                    ? "bg-gradient-to-r from-rose-600 to-orange-600 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
                }
              >
                {intervalBlocking ? "Ativado (bloqueante)" : "Desativado (apenas alerta)"}
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
              {jornadaValidationConfig ? (
                <div className="grid grid-cols-1 gap-1">
                  <div>
                    <span className="text-zinc-600">Modo atual:</span>{" "}
                    {jornadaValidationConfig.intervalo_exige_4_batidas_blocking ? "Bloqueante" : "Somente alerta"}
                  </div>
                  <div>
                    <span className="text-zinc-600">Atualizado em:</span> {formatDateTimeSP(jornadaValidationConfig.updated_at)}
                  </div>
                </div>
              ) : (
                <div className="text-zinc-600">Ainda não carregado.</div>
              )}
            </div>

            {error ? (
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
            ) : null}
            {success ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{success}</div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!token || jornadaValidationSaving}
                className="h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
              >
                {jornadaValidationSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>

            {!token ? <div className="text-xs text-zinc-600">Você precisa estar logado como admin para salvar.</div> : null}
          </form>
        </div>
      </div>
    </AppShell>
  );
}
