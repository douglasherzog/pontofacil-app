import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.deps import get_db
from app.models import ConfigLocal, JornadaValidationConfig, Ponto, PontoTipo, User, UserRole
from app.schemas import JornadaDiaOut, JornadaSegmentOut, PontoAutoCreate, PontoCreate, PontoOut


SP_TZ = ZoneInfo("America/Sao_Paulo")


def _utc_naive_to_sp(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).astimezone(SP_TZ)


def _sp_date_to_utc_naive_start(date_str: str) -> datetime:
    return datetime.fromisoformat(date_str).replace(tzinfo=SP_TZ).astimezone(timezone.utc).replace(tzinfo=None)


def _sp_date_to_utc_naive_end_exclusive(date_str: str) -> datetime:
    return (
        (datetime.fromisoformat(date_str) + timedelta(days=1))
        .replace(tzinfo=SP_TZ)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )


def _get_last_ponto_in_sp_day(db: Session, user_id: int, date_str: str) -> Ponto | None:
    start_dt = _sp_date_to_utc_naive_start(date_str)
    end_dt = _sp_date_to_utc_naive_end_exclusive(date_str)
    return (
        db.query(Ponto)
        .filter(Ponto.user_id == user_id)
        .filter(Ponto.registrado_em >= start_dt)
        .filter(Ponto.registrado_em < end_dt)
        .order_by(Ponto.registrado_em.desc())
        .first()
    )


def _strict_next_tipo_from_last(last: Ponto | None) -> str:
    if not last:
        return "entrada"

    last_tipo = last.tipo.value
    next_map = {
        "entrada": "intervalo_inicio",
        "intervalo_inicio": "intervalo_fim",
        "intervalo_fim": "saida",
    }
    return next_map.get(last_tipo, "")

router = APIRouter(prefix="/pontos", tags=["pontos"])


def _fmt_hhmm(total_seconds: int) -> str:
    total_seconds = max(0, int(total_seconds))
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    return f"{h:02d}:{m:02d}"


def _compute_jornada_from_pontos(date_str: str, pontos: list[Ponto]) -> tuple[int, list[JornadaSegmentOut], list[str]]:
    alertas: list[str] = []
    segmentos: list[JornadaSegmentOut] = []
    total_trabalhado_segundos = 0

    pontos_sorted = sorted(pontos, key=lambda p: p.registrado_em)

    has_intervalo = any(p.tipo.value in ("intervalo_inicio", "intervalo_fim") for p in pontos_sorted)

    work_start: datetime | None = None
    break_start: datetime | None = None
    intervalo_segundos_atual = 0

    for p in pontos_sorted:
        ts = p.registrado_em
        tipo = p.tipo.value

        if tipo == "entrada":
            if work_start is not None:
                alertas.append("Entrada duplicada (já havia uma entrada aberta)")
                continue
            if break_start is not None:
                alertas.append("Entrada com intervalo aberto (sequência inválida)")
                break_start = None
            work_start = ts
            continue

        if tipo == "intervalo_inicio":
            if work_start is None:
                alertas.append("Início de intervalo sem entrada")
                continue
            if break_start is not None:
                alertas.append("Início de intervalo duplicado (intervalo já estava aberto)")
                continue
            break_start = ts
            continue

        if tipo == "intervalo_fim":
            if break_start is None:
                alertas.append("Fim de intervalo sem início de intervalo")
                continue
            if ts <= break_start:
                alertas.append("Fim de intervalo anterior ao início (horário inválido)")
                break_start = None
                continue

            segundos = int((ts - break_start).total_seconds())
            intervalo_segundos_atual += max(0, segundos)
            segmentos.append(
                JornadaSegmentOut(
                    tipo="intervalo",
                    inicio=_utc_naive_to_sp(break_start),
                    fim=_utc_naive_to_sp(ts),
                    segundos=segundos,
                )
            )
            break_start = None
            continue

        if tipo == "saida":
            if work_start is None:
                alertas.append("Saída sem entrada")
                continue
            if break_start is not None:
                alertas.append("Saída com intervalo aberto (intervalo não finalizado)")
                break_start = None

            if ts <= work_start:
                alertas.append("Saída anterior à entrada (horário inválido)")
                work_start = None
                intervalo_segundos_atual = 0
                continue

            segundos_brutos = int((ts - work_start).total_seconds())
            segundos_trabalho = max(0, segundos_brutos - intervalo_segundos_atual)

            segmentos.append(
                JornadaSegmentOut(
                    tipo="trabalho",
                    inicio=_utc_naive_to_sp(work_start),
                    fim=_utc_naive_to_sp(ts),
                    segundos=segundos_trabalho,
                )
            )
            total_trabalhado_segundos += segundos_trabalho

            work_start = None
            break_start = None
            intervalo_segundos_atual = 0
            continue

        alertas.append(f"Tipo de ponto desconhecido: {tipo}")

    if break_start is not None:
        alertas.append("Intervalo iniciado e não finalizado")
    if work_start is not None:
        alertas.append("Entrada registrada, mas sem saída")

    if not pontos_sorted:
        alertas.append("Nenhum ponto registrado no dia")

    if has_intervalo and len(pontos_sorted) != 4:
        alertas.append("Intervalo exige exatamente 4 batidas no dia (entrada, intervalo início, intervalo fim, saída)")

    return total_trabalhado_segundos, segmentos, alertas


def _get_jornada_validation_config(db: Session) -> JornadaValidationConfig:
    row = db.query(JornadaValidationConfig).filter(JornadaValidationConfig.id == 1).first()
    if not row:
        row = JornadaValidationConfig(id=1, intervalo_exige_4_batidas_blocking=False, updated_at=datetime.utcnow())
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.post("", response_model=PontoOut)
def create_ponto(
    payload: PontoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Administrador não registra ponto")

    now_sp = datetime.now(tz=SP_TZ)
    date_str = now_sp.date().isoformat()
    last = _get_last_ponto_in_sp_day(db, current_user.id, date_str)

    if last and last.tipo.value == "saida":
        raise HTTPException(
            status_code=422,
            detail="Você já registrou a saída hoje. Se precisar corrigir, fale com o administrador.",
        )

    expected = _strict_next_tipo_from_last(last)
    if payload.tipo != expected:
        if expected == "entrada":
            raise HTTPException(status_code=422, detail="A próxima batida deve ser ENTRADA")
        if expected == "intervalo_inicio":
            raise HTTPException(status_code=422, detail="A próxima batida deve ser INÍCIO DO INTERVALO")
        if expected == "intervalo_fim":
            raise HTTPException(status_code=422, detail="A próxima batida deve ser FIM DO INTERVALO")
        if expected == "saida":
            raise HTTPException(status_code=422, detail="A próxima batida deve ser SAÍDA")
        raise HTTPException(status_code=422, detail="Sequência de batidas inválida")

    config = db.query(ConfigLocal).filter(ConfigLocal.id == 1).first()
    distancia_m = None
    if config:
        distancia_m = _haversine_distance_m(payload.lat, payload.lng, config.local_lat, config.local_lng)
        if distancia_m > config.raio_m:
            raise HTTPException(
                status_code=403,
                detail=(
                    "ADVERTÊNCIA: tentativa de registro de ponto fora do local permitido. "
                    f"Distância aproximada: {round(distancia_m)}m. Raio permitido: {config.raio_m}m. "
                    "Aproxime-se do local de trabalho e tente novamente."
                ),
            )

    row = Ponto(
        user_id=current_user.id,
        tipo=PontoTipo(payload.tipo),
        lat=payload.lat,
        lng=payload.lng,
        accuracy_m=payload.accuracy_m,
        distancia_m=distancia_m,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return PontoOut(
        id=row.id,
        tipo=row.tipo.value,
        registrado_em=_utc_naive_to_sp(row.registrado_em),
        lat=row.lat,
        lng=row.lng,
        accuracy_m=row.accuracy_m,
        distancia_m=row.distancia_m,
    )


@router.post("/auto", response_model=PontoOut)
def create_ponto_auto(
    payload: PontoAutoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Administrador não registra ponto")

    now_sp = datetime.now(tz=SP_TZ)
    date_str = now_sp.date().isoformat()
    last = _get_last_ponto_in_sp_day(db, current_user.id, date_str)

    if last:
        now_utc_naive = datetime.utcnow()
        delta_s = (now_utc_naive - last.registrado_em).total_seconds()
        if delta_s >= 0 and delta_s < 15:
            raise HTTPException(status_code=409, detail="Aguarde 15 segundos antes de bater o ponto novamente")

    if last and last.tipo.value == "saida":
        raise HTTPException(
            status_code=422,
            detail="Você já registrou a saída hoje. Se precisar corrigir, fale com o administrador.",
        )

    next_tipo = _strict_next_tipo_from_last(last)
    if not next_tipo:
        raise HTTPException(status_code=422, detail="Sequência de batidas inválida")

    config = db.query(ConfigLocal).filter(ConfigLocal.id == 1).first()
    distancia_m = None
    if config:
        distancia_m = _haversine_distance_m(payload.lat, payload.lng, config.local_lat, config.local_lng)
        if distancia_m > config.raio_m:
            raise HTTPException(
                status_code=403,
                detail=(
                    "ADVERTÊNCIA: tentativa de registro de ponto fora do local permitido. "
                    f"Distância aproximada: {round(distancia_m)}m. Raio permitido: {config.raio_m}m. "
                    "Aproxime-se do local de trabalho e tente novamente."
                ),
            )

    row = Ponto(
        user_id=current_user.id,
        tipo=PontoTipo(next_tipo),
        lat=payload.lat,
        lng=payload.lng,
        accuracy_m=payload.accuracy_m,
        distancia_m=distancia_m,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return PontoOut(
        id=row.id,
        tipo=row.tipo.value,
        registrado_em=_utc_naive_to_sp(row.registrado_em),
        lat=row.lat,
        lng=row.lng,
        accuracy_m=row.accuracy_m,
        distancia_m=row.distancia_m,
    )


def _haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@router.get("/me", response_model=list[PontoOut])
def list_my_pontos(
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Ponto).filter(Ponto.user_id == current_user.id)

    if start:
        q = q.filter(Ponto.registrado_em >= _sp_date_to_utc_naive_start(start))
    if end:
        q = q.filter(Ponto.registrado_em < _sp_date_to_utc_naive_end_exclusive(end))

    rows = q.order_by(Ponto.registrado_em.desc()).limit(200).all()

    return [
        PontoOut(
            id=r.id,
            tipo=r.tipo.value,
            registrado_em=_utc_naive_to_sp(r.registrado_em),
            lat=r.lat,
            lng=r.lng,
            accuracy_m=r.accuracy_m,
            distancia_m=r.distancia_m,
        )
        for r in rows
    ]


@router.get("/jornada", response_model=JornadaDiaOut)
def jornada_do_dia(
    date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Administrador não possui jornada")

    start_dt = _sp_date_to_utc_naive_start(date)
    end_dt = _sp_date_to_utc_naive_end_exclusive(date)
    pontos = (
        db.query(Ponto)
        .filter(Ponto.user_id == current_user.id)
        .filter(Ponto.registrado_em >= start_dt)
        .filter(Ponto.registrado_em < end_dt)
        .all()
    )

    total_s, segmentos, alertas = _compute_jornada_from_pontos(date, pontos)

    cfg = _get_jornada_validation_config(db)
    if bool(cfg.intervalo_exige_4_batidas_blocking):
        has_intervalo = any(p.tipo.value in ("intervalo_inicio", "intervalo_fim") for p in pontos)
        if has_intervalo and len(pontos) != 4:
            raise HTTPException(
                status_code=422,
                detail="Intervalo exige exatamente 4 batidas no dia (entrada, intervalo início, intervalo fim, saída)",
            )

    return JornadaDiaOut(
        data=date,
        total_trabalhado_segundos=total_s,
        total_trabalhado_hhmm=_fmt_hhmm(total_s),
        segmentos=segmentos,
        alertas=alertas,
    )
