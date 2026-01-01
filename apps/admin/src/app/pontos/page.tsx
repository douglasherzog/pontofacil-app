"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import { formatDateBR, formatDateTimeSP } from "@/lib/dateFormat";
import { getToken } from "@/lib/tokenStorage";

type PontoTipo = "entrada" | "saida" | "intervalo_inicio" | "intervalo_fim";

type PontoOut = {
  id: number;
  tipo: PontoTipo;
  registrado_em: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  distancia_m: number | null;
};

type ConfigLocalOut = {
  local_lat: number;
  local_lng: number;
  raio_m: number;
  updated_at: string;
};

type UserMe = {
  id: number;
  email: string;
  role: "admin" | "employee";
};

type EmployeeOut = {
  id: number;
  email: string;
  nome: string;
  is_active: boolean;
};

type PontoAdminOut = PontoOut & {
  user_id: number;
  email: string;
  nome: string;
};

type JornadaSegmentOut = {
  tipo: "trabalho" | "intervalo";
  inicio: string;
  fim: string;
  segundos: number;
};

type JornadaDiaOut = {
  data: string;
  total_trabalhado_segundos: number;
  total_trabalhado_hhmm: string;
  segmentos: JornadaSegmentOut[];
  alertas: string[];
};

type AdminPontoCreatePayload = {
  user_id: number;
  tipo: PontoTipo;
  date: string;
  time: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  distancia_m: number | null;
  motivo: string;
};

function base64UrlDecodeToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function spPartsFromIso(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  return { date, time };
}

function formatHHMMInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidHHMM(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hhStr, mmStr] = value.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  return Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function getRoleFromToken(token: string | undefined): UserMe["role"] | null {
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

export default function PontosPage() {
  const token = useMemo(() => getToken() ?? undefined, []);
  const [items, setItems] = useState<PontoOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [employeeCooldownS, setEmployeeCooldownS] = useState<number>(0);

  const [me, setMe] = useState<UserMe | null>(null);
  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [adminPontos, setAdminPontos] = useState<PontoAdminOut[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const spNow = useMemo(() => spPartsFromIso(new Date().toISOString()), []);

  const [rangeStart, setRangeStart] = useState<string>(today);
  const [rangeEnd, setRangeEnd] = useState<string>(today);
  const [adminRangeStart, setAdminRangeStart] = useState<string>(today);
  const [adminRangeEnd, setAdminRangeEnd] = useState<string>(today);

  const [jornadaDate, setJornadaDate] = useState<string>(today);
  const [adminJornadaDate, setAdminJornadaDate] = useState<string>(today);

  const [jornada, setJornada] = useState<JornadaDiaOut | null>(null);
  const [jornadaLoading, setJornadaLoading] = useState(false);
  const [jornadaError, setJornadaError] = useState<string | null>(null);

  const [adminJornada, setAdminJornada] = useState<JornadaDiaOut | null>(null);
  const [adminJornadaLoading, setAdminJornadaLoading] = useState(false);
  const [adminJornadaError, setAdminJornadaError] = useState<string | null>(null);

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminModalMode, setAdminModalMode] = useState<"create" | "edit" | "delete">("create");
  const [adminModalTarget, setAdminModalTarget] = useState<PontoAdminOut | null>(null);
  const [adminModalTipo, setAdminModalTipo] = useState<PontoTipo>("entrada");
  const [adminModalDate, setAdminModalDate] = useState<string>(spNow.date || today);
  const [adminModalTime, setAdminModalTime] = useState<string>(spNow.time || "08:00");
  const [adminModalLat, setAdminModalLat] = useState<string>("0");
  const [adminModalLng, setAdminModalLng] = useState<string>("0");
  const [adminModalAccuracyM, setAdminModalAccuracyM] = useState<number | null>(null);
  const [adminModalDistanciaM, setAdminModalDistanciaM] = useState<number | null>(null);
  const [adminModalMotivo, setAdminModalMotivo] = useState<string>("");
  const [adminModalSaving, setAdminModalSaving] = useState(false);
  const [adminModalError, setAdminModalError] = useState<string | null>(null);
  const [adminModalLocLoading, setAdminModalLocLoading] = useState(false);

  const tokenRole = useMemo(() => getRoleFromToken(token), [token]);
  const isAdmin = me?.role === "admin" || tokenRole === "admin";

  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy_m: number | null } | null>(null);
  const [configLocal, setConfigLocal] = useState<ConfigLocalOut | null>(null);

  async function loadPontos() {
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    const qs = new URLSearchParams();
    if (rangeStart) qs.set("start", rangeStart);
    if (rangeEnd) qs.set("end", rangeEnd);
    const path = `/pontos/me${qs.toString() ? `?${qs.toString()}` : ""}`;
    const res = await apiRequest<PontoOut[]>(path, { method: "GET", token });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setErrorStatus(res.status ?? null);
      return;
    }
    setItems(res.data);
  }

  async function loadMeAndAdminData() {
    if (!token) return;
    setAdminError(null);

    const meRes = await apiRequest<UserMe>("/admin/me", { method: "GET", token });
    if (!meRes.ok) {
      // If not admin, /admin/me returns 403; that's fine.
      // If it's some other error, surface it. Also keep admin UI available
      // when token indicates admin (fallback).
      if (meRes.status && meRes.status !== 403) {
        setAdminError(meRes.error);
      }
      setMe(null);
      if (tokenRole !== "admin") return;
    }

    if (meRes.ok) {
      setMe(meRes.data);
    }

    const employeesRes = await apiRequest<EmployeeOut[]>("/admin/funcionarios", { method: "GET", token });
    if (!employeesRes.ok) {
      setAdminError(employeesRes.error);
      return;
    }

    setEmployees(employeesRes.data);
    if (employeesRes.data.length > 0 && selectedEmployeeId === null) {
      setSelectedEmployeeId(employeesRes.data[0].id);
    }
  }

  async function loadAdminPontos(employeeId: number) {
    if (!token) return;
    setAdminLoading(true);
    setAdminError(null);
    const qs = new URLSearchParams();
    qs.set("user_id", String(employeeId));
    if (adminRangeStart) qs.set("start", adminRangeStart);
    if (adminRangeEnd) qs.set("end", adminRangeEnd);
    const res = await apiRequest<PontoAdminOut[]>(`/admin/pontos?${qs.toString()}`, { method: "GET", token });
    setAdminLoading(false);
    if (!res.ok) {
      setAdminError(res.error);
      return;
    }
    setAdminPontos(res.data);
  }

  function openAdminCreateModal() {
    if (!token || selectedEmployeeId === null) return;
    setAdminModalError(null);
    setAdminModalMode("create");
    setAdminModalTarget(null);
    setAdminModalTipo("entrada");
    const nowSp = spPartsFromIso(new Date().toISOString());
    setAdminModalDate(adminRangeStart || nowSp.date || today);
    setAdminModalTime(nowSp.time || "08:00");
    setAdminModalLat("0");
    setAdminModalLng("0");
    setAdminModalAccuracyM(null);
    setAdminModalDistanciaM(null);
    setAdminModalMotivo("");
    setAdminModalOpen(true);
  }

  function openAdminEditModal(p: PontoAdminOut) {
    setAdminModalError(null);
    setAdminModalMode("edit");
    setAdminModalTarget(p);
    setAdminModalTipo(p.tipo);
    const parts = spPartsFromIso(p.registrado_em);
    setAdminModalDate(parts.date);
    setAdminModalTime(parts.time);
    setAdminModalLat(String(p.lat));
    setAdminModalLng(String(p.lng));
    setAdminModalAccuracyM(p.accuracy_m);
    setAdminModalDistanciaM(p.distancia_m);
    setAdminModalMotivo("");
    setAdminModalOpen(true);
  }

  function openAdminDeleteModal(p: PontoAdminOut) {
    setAdminModalError(null);
    setAdminModalMode("delete");
    setAdminModalTarget(p);
    setAdminModalMotivo("");
    setAdminModalOpen(true);
  }

  function getLastEmployeeLocation(): { lat: number; lng: number; accuracy_m: number | null; distancia_m: number | null } | null {
    const last = adminPontos.find(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        (Math.abs(p.lat) > 0.000001 || Math.abs(p.lng) > 0.000001)
    );
    if (!last) return null;
    return {
      lat: last.lat,
      lng: last.lng,
      accuracy_m: last.accuracy_m,
      distancia_m: last.distancia_m,
    };
  }

  async function applyAdminLocationFromBrowser() {
    setAdminModalLocLoading(true);
    setAdminModalError(null);
    try {
      const loc = await getLocation();
      setAdminModalLat(String(loc.lat));
      setAdminModalLng(String(loc.lng));
      setAdminModalAccuracyM(loc.accuracy_m);
      if (configLocal) {
        const d = haversineDistanceM(loc.lat, loc.lng, configLocal.local_lat, configLocal.local_lng);
        setAdminModalDistanciaM(d);
      } else {
        setAdminModalDistanciaM(null);
      }
    } catch {
      setAdminModalError("Não foi possível obter a localização atual. Verifique as permissões do navegador.");
    } finally {
      setAdminModalLocLoading(false);
    }
  }

  async function applyAdminLocationFromEmployeeLast() {
    if (!token) return;
    if (selectedEmployeeId === null) return;
    setAdminModalLocLoading(true);
    setAdminModalError(null);
    try {
      const res = await apiRequest<PontoAdminOut>(`/admin/pontos/last?user_id=${encodeURIComponent(String(selectedEmployeeId))}`, {
        method: "GET",
        token,
      });
      if (!res.ok) {
        const fallback = getLastEmployeeLocation();
        if (fallback) {
          setAdminModalLat(String(fallback.lat));
          setAdminModalLng(String(fallback.lng));
          setAdminModalAccuracyM(fallback.accuracy_m);
          setAdminModalDistanciaM(fallback.distancia_m);
          return;
        }
        setAdminModalError(res.error);
        return;
      }

      setAdminModalLat(String(res.data.lat));
      setAdminModalLng(String(res.data.lng));
      setAdminModalAccuracyM(res.data.accuracy_m);
      setAdminModalDistanciaM(res.data.distancia_m);
    } catch {
      const fallback = getLastEmployeeLocation();
      if (fallback) {
        setAdminModalLat(String(fallback.lat));
        setAdminModalLng(String(fallback.lng));
        setAdminModalAccuracyM(fallback.accuracy_m);
        setAdminModalDistanciaM(fallback.distancia_m);
        return;
      }
      setAdminModalError("Falha ao buscar última localização do funcionário.");
    } finally {
      setAdminModalLocLoading(false);
    }
  }

  async function submitAdminModal() {
    if (!token) return;
    if (selectedEmployeeId === null) return;

    setAdminModalSaving(true);
    setAdminModalError(null);

    try {
      if (adminModalMode === "delete") {
        if (!adminModalTarget) {
          setAdminModalSaving(false);
          setAdminModalError("Seleção inválida.");
          return;
        }

        const motivo = adminModalMotivo.trim();
        if (motivo.length < 3) {
          setAdminModalSaving(false);
          setAdminModalError("Informe um motivo (mínimo 3 caracteres). ");
          return;
        }

        const res = await apiRequest<{ ok: boolean }>(`/admin/pontos/${adminModalTarget.id}`, {
          method: "DELETE",
          token,
          body: JSON.stringify({ motivo }),
        });
        if (!res.ok) {
          setAdminModalSaving(false);
          setAdminModalError(res.error);
          return;
        }

        setAdminModalOpen(false);
        await loadAdminPontos(selectedEmployeeId);
        await loadAdminJornada(selectedEmployeeId);
        return;
      }

      const motivo = adminModalMotivo.trim();
      if (motivo.length < 3) {
        setAdminModalSaving(false);
        setAdminModalError("Informe um motivo (mínimo 3 caracteres). ");
        return;
      }

      if (!isValidHHMM(adminModalTime)) {
        setAdminModalSaving(false);
        setAdminModalError("Hora inválida. Informe no formato HH:MM (ex.: 08:30)");
        return;
      }

      const lat = Number(adminModalLat);
      const lng = Number(adminModalLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setAdminModalSaving(false);
        setAdminModalError("Latitude/Longitude inválidos.");
        return;
      }

      const payload: AdminPontoCreatePayload = {
        user_id: selectedEmployeeId,
        tipo: adminModalTipo,
        date: adminModalDate,
        time: adminModalTime,
        lat,
        lng,
        accuracy_m: adminModalAccuracyM,
        distancia_m: adminModalDistanciaM,
        motivo,
      };

      if (adminModalMode === "create") {
        const res = await apiRequest<PontoAdminOut>("/admin/pontos", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setAdminModalSaving(false);
          setAdminModalError(res.error);
          return;
        }
      }

      if (adminModalMode === "edit") {
        if (!adminModalTarget) {
          setAdminModalSaving(false);
          setAdminModalError("Seleção inválida.");
          return;
        }
        const res = await apiRequest<PontoAdminOut>(`/admin/pontos/${adminModalTarget.id}`, {
          method: "PUT",
          token,
          body: JSON.stringify({
            tipo: payload.tipo,
            date: payload.date,
            time: payload.time,
            lat: payload.lat,
            lng: payload.lng,
            accuracy_m: payload.accuracy_m,
            distancia_m: payload.distancia_m,
            motivo: payload.motivo,
          }),
        });
        if (!res.ok) {
          setAdminModalSaving(false);
          setAdminModalError(res.error);
          return;
        }
      }

      setAdminModalOpen(false);
      await loadAdminPontos(selectedEmployeeId);
      await loadAdminJornada(selectedEmployeeId);
    } catch {
      setAdminModalError("Falha ao salvar. Verifique a conexão e tente novamente.");
    } finally {
      setAdminModalSaving(false);
    }
  }

  async function loadConfigLocal() {
    const res = await apiRequest<ConfigLocalOut | null>("/config-local", { method: "GET" });
    if (!res.ok) return;
    setConfigLocal(res.data);
  }

  async function loadJornada() {
    if (!token) return;
    setJornadaLoading(true);
    setJornadaError(null);
    const res = await apiRequest<JornadaDiaOut>(`/pontos/jornada?date=${encodeURIComponent(jornadaDate)}`, {
      method: "GET",
      token,
    });
    setJornadaLoading(false);
    if (!res.ok) {
      setJornadaError(res.error);
      setJornada(null);
      return;
    }
    setJornada(res.data);
  }

  async function loadAdminJornada(employeeId: number) {
    if (!token) return;
    setAdminJornadaLoading(true);
    setAdminJornadaError(null);
    const qs = new URLSearchParams();
    qs.set("user_id", String(employeeId));
    qs.set("date", adminJornadaDate);
    const res = await apiRequest<JornadaDiaOut>(`/admin/jornada?${qs.toString()}`, {
      method: "GET",
      token,
    });
    setAdminJornadaLoading(false);
    if (!res.ok) {
      setAdminJornadaError(res.error);
      setAdminJornada(null);
      return;
    }
    setAdminJornada(res.data);
  }

  function getLocation(): Promise<{ lat: number; lng: number; accuracy_m: number | null }> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Geolocalização não suportada neste navegador."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  useEffect(() => {
    loadConfigLocal();
    loadPontos();
    loadMeAndAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (employeeCooldownS <= 0) return;
    const t = setInterval(() => {
      setEmployeeCooldownS((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [employeeCooldownS]);

  useEffect(() => {
    if (isAdmin) return;
    loadJornada();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, jornadaDate]);

  useEffect(() => {
    if (!isAdmin) return;
    if (selectedEmployeeId === null) return;
    loadAdminPontos(selectedEmployeeId);
    loadAdminJornada(selectedEmployeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedEmployeeId, adminJornadaDate]);

  return (
    <AppShell title="Pontos">
      <div className={isAdmin ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 lg:grid-cols-2"}>
        {!isAdmin ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold">Bater ponto</div>
            <div className="mt-1 text-sm text-zinc-600">
              Toque em "Bater ponto agora" para registrar com sua localização atual.
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={sending || !token || employeeCooldownS > 0}
                  onClick={async () => {
                    setSending(true);
                    setError(null);
                    setErrorStatus(null);
                    setSuccess(null);

                    try {
                      const loc = await getLocation();
                      setPosition(loc);

                      const res = await apiRequest<PontoOut>("/pontos/auto", {
                        method: "POST",
                        token,
                        body: JSON.stringify({
                          lat: loc.lat,
                          lng: loc.lng,
                          accuracy_m: loc.accuracy_m,
                        }),
                      });

                      if (!res.ok) {
                        setError(res.error);
                        setErrorStatus(res.status ?? null);
                        if (res.status === 409) {
                          setEmployeeCooldownS(15);
                        }
                        return;
                      }

                      setSuccess(`Ponto registrado: ${res.data.tipo}`);
                      setEmployeeCooldownS(15);
                      await loadPontos();
                      await loadJornada();
                    } catch {
                      setError("Falha ao registrar ponto. Verifique sua conexão e permissões de localização.");
                    } finally {
                      setSending(false);
                    }
                  }}
                  className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-6 text-lg font-extrabold text-white shadow-lg disabled:opacity-60"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 8v5l3 2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>
                    {sending
                      ? "Registrando..."
                      : employeeCooldownS > 0
                        ? `Aguarde ${employeeCooldownS}s...`
                        : "Bater ponto agora"}
                  </span>
                </button>
              </div>

              {!token ? <div className="text-xs text-zinc-600">Você precisa estar logado para bater ponto.</div> : null}

              {position ? (
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-700 ring-1 ring-zinc-200">
                  lat={position.lat.toFixed(6)} lng={position.lng.toFixed(6)}
                  {typeof position.accuracy_m === "number" ? ` (±${Math.round(position.accuracy_m)}m)` : ""}
                </div>
              ) : (
                <div className="text-xs text-zinc-600">Localização ainda não capturada.</div>
              )}

              {configLocal ? (
                <div className="text-xs text-zinc-600">
                  Local cadastrado: {configLocal.local_lat.toFixed(5)}, {configLocal.local_lng.toFixed(5)} (raio {configLocal.raio_m}m)
                </div>
              ) : (
                <div className="text-xs text-zinc-600">Local cadastrado não configurado (distância ficará em branco).</div>
              )}

              {error ? (
                errorStatus === 403 ? (
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
                    <div className="text-xs font-extrabold tracking-wide text-rose-900">ADVERTÊNCIA</div>
                    <div className="mt-1 font-semibold">Registro de ponto bloqueado</div>
                    <div className="mt-2 leading-relaxed">{error}</div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
                )
              ) : null}
              {success ? (
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
                  {success}
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Jornada de hoje</div>
                    <div className="mt-1 text-sm text-zinc-600">Total trabalhado e alertas.</div>
                  </div>
                </div>

                <div className="mt-4">
                  {jornadaLoading ? (
                    <div className="text-sm text-zinc-600">Carregando...</div>
                  ) : jornadaError ? (
                    <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{jornadaError}</div>
                  ) : jornada ? (
                    <>
                      <div className="text-sm font-semibold">Total: {jornada.total_trabalhado_hhmm}</div>
                      {jornada.alertas?.length ? (
                        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
                          <div className="text-xs font-extrabold tracking-wide">ALERTAS</div>
                          <ul className="mt-2 list-disc pl-5">
                            {jornada.alertas.map((a, idx) => (
                              <li key={idx}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-emerald-700">Sem alertas.</div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-zinc-600">Sem dados.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          {isAdmin ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Pontos de funcionários</div>
                  <div className="mt-1 text-sm text-zinc-600">Selecione um funcionário para ver os registros.</div>
                </div>

                <div className="flex min-w-0 flex-col gap-3 sm:items-end">
                  <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <label className="text-[11px] font-semibold text-zinc-600">Início</label>
                      <input
                        type="date"
                        value={adminRangeStart}
                        onChange={(e) => setAdminRangeStart(e.target.value)}
                        className="h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <label className="text-[11px] font-semibold text-zinc-600">Fim</label>
                      <input
                        type="date"
                        value={adminRangeEnd}
                        onChange={(e) => setAdminRangeEnd(e.target.value)}
                        className="h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <label className="text-[11px] font-semibold text-zinc-600">Jornada</label>
                      <input
                        type="date"
                        value={adminJornadaDate}
                        onChange={(e) => setAdminJornadaDate(e.target.value)}
                        className="h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <select
                      value={selectedEmployeeId ?? ""}
                      onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
                      className="h-10 min-w-0 w-full max-w-full truncate rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none sm:w-[420px]"
                    >
                      {employees.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome} ({u.email})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        if (selectedEmployeeId !== null) {
                          loadAdminPontos(selectedEmployeeId);
                          loadAdminJornada(selectedEmployeeId);
                        }
                      }}
                      className="h-10 w-full flex-shrink-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
                    >
                      Atualizar
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                {adminJornadaLoading ? (
                  <div className="text-sm text-zinc-600">Carregando jornada...</div>
                ) : adminJornadaError ? (
                  <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{adminJornadaError}</div>
                ) : adminJornada ? (
                  <>
                    <div className="text-sm font-semibold">
                      Jornada ({formatDateBR(adminJornada.data)}) — Total: {adminJornada.total_trabalhado_hhmm}
                    </div>
                    {adminJornada.alertas?.length ? (
                      <div className="mt-2 text-sm text-amber-900">Alertas: {adminJornada.alertas.join(" | ")}</div>
                    ) : (
                      <div className="mt-2 text-sm text-emerald-700">Sem alertas.</div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-zinc-600">Sem dados de jornada.</div>
                )}
              </div>

              {adminError ? (
                <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{adminError}</div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openAdminCreateModal()}
                  disabled={!token || selectedEmployeeId === null}
                  className="h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
                >
                  Adicionar ponto
                </button>
                <div className="text-xs text-zinc-600">Sempre informe um motivo ao corrigir.</div>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                    <tr>
                      <th className="px-3 py-2">Quando</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Distância</th>
                      <th className="px-3 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLoading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-zinc-600">
                          Carregando...
                        </td>
                      </tr>
                    ) : adminPontos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-zinc-600">
                          Nenhum ponto para este funcionário.
                        </td>
                      </tr>
                    ) : (
                      adminPontos.map((p) => (
                        <tr key={p.id} className="border-t border-zinc-100">
                          <td className="px-3 py-2 text-zinc-800">{formatDateTimeSP(p.registrado_em)}</td>
                          <td className="px-3 py-2 font-medium text-zinc-900">{p.tipo}</td>
                          <td className="px-3 py-2 text-zinc-700">
                            {typeof p.distancia_m === "number" ? `${Math.round(p.distancia_m)}m` : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openAdminEditModal(p)}
                                className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => openAdminDeleteModal(p)}
                                className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                              >
                                Remover
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {adminModalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {adminModalMode === "create"
                            ? "Adicionar ponto"
                            : adminModalMode === "edit"
                              ? "Editar ponto"
                              : "Remover ponto"}
                        </div>
                        <div className="mt-1 text-sm text-zinc-600">
                          {adminModalTarget ? formatDateTimeSP(adminModalTarget.registrado_em) : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdminModalOpen(false)}
                        className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Fechar
                      </button>
                    </div>

                    <div className="mt-4 flex flex-col gap-3">
                      {adminModalMode !== "delete" ? (
                        <>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-zinc-700">Data</label>
                              <input
                                type="date"
                                value={adminModalDate}
                                onChange={(e) => setAdminModalDate(e.target.value)}
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-zinc-700">Hora (HH:MM)</label>
                              <input
                                value={adminModalTime}
                                onChange={(e) => setAdminModalTime(formatHHMMInput(e.target.value))}
                                inputMode="numeric"
                                maxLength={5}
                                autoComplete="off"
                                pattern="^\\d{2}:\\d{2}$"
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                                placeholder="08:00"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-zinc-700">Tipo</label>
                            <select
                              value={adminModalTipo}
                              onChange={(e) => setAdminModalTipo(e.target.value as PontoTipo)}
                              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                              <option value="entrada">Entrada</option>
                              <option value="intervalo_inicio">Início intervalo</option>
                              <option value="intervalo_fim">Fim intervalo</option>
                              <option value="saida">Saída</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-zinc-700">Latitude</label>
                              <input
                                value={adminModalLat}
                                onChange={(e) => setAdminModalLat(e.target.value)}
                                inputMode="decimal"
                                autoComplete="off"
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                                placeholder="-23.55052"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-zinc-700">Longitude</label>
                              <input
                                value={adminModalLng}
                                onChange={(e) => setAdminModalLng(e.target.value)}
                                inputMode="decimal"
                                autoComplete="off"
                                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                                placeholder="-46.63331"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => applyAdminLocationFromBrowser()}
                              disabled={adminModalLocLoading}
                              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                            >
                              {adminModalLocLoading ? "Obtendo..." : "Usar minha localização atual"}
                            </button>
                            <button
                              type="button"
                              onClick={() => applyAdminLocationFromEmployeeLast()}
                              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                            >
                              Usar última do funcionário
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdminModalLat("0");
                                setAdminModalLng("0");
                                setAdminModalAccuracyM(null);
                                setAdminModalDistanciaM(null);
                              }}
                              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                            >
                              Limpar
                            </button>
                          </div>

                          <div className="text-xs text-zinc-600">
                            {typeof adminModalAccuracyM === "number" ? `Precisão: ±${Math.round(adminModalAccuracyM)}m. ` : ""}
                            {typeof adminModalDistanciaM === "number" ? `Distância: ${Math.round(adminModalDistanciaM)}m.` : ""}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
                          Esta ação remove o ponto selecionado.
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-zinc-700">Motivo</label>
                        <textarea
                          value={adminModalMotivo}
                          onChange={(e) => setAdminModalMotivo(e.target.value)}
                          className="min-h-[90px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="Ex: Funcionário esqueceu a entrada"
                        />
                      </div>

                      {adminModalError ? (
                        <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{adminModalError}</div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAdminModalOpen(false)}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => submitAdminModal()}
                          disabled={adminModalSaving}
                          className={
                            adminModalMode === "delete"
                              ? "h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
                              : "h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 text-sm font-semibold text-white shadow disabled:opacity-60"
                          }
                        >
                          {adminModalSaving ? "Salvando..." : adminModalMode === "delete" ? "Remover" : "Salvar"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Meus pontos</div>
                  <div className="mt-1 text-sm text-zinc-600">Últimos registros (até 100).</div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none sm:w-auto"
                  />
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none sm:w-auto"
                  />
                  <button
                    type="button"
                    onClick={() => loadPontos()}
                    className="h-10 w-full flex-shrink-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                    <tr>
                      <th className="px-3 py-2">Quando</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Distância</th>
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
                          Nenhum ponto registrado ainda.
                        </td>
                      </tr>
                    ) : (
                      items.map((p) => (
                        <tr key={p.id} className="border-t border-zinc-100">
                          <td className="px-3 py-2 text-zinc-800">{formatDateTimeSP(p.registrado_em)}</td>
                          <td className="px-3 py-2 font-medium text-zinc-900">{p.tipo}</td>
                          <td className="px-3 py-2 text-zinc-700">
                            {typeof p.distancia_m === "number" ? `${Math.round(p.distancia_m)}m` : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
