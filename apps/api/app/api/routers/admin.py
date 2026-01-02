import json
import re
import base64
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, aliased

from app.api.deps import require_admin
from app.core.security import hash_password
from app.db.deps import get_db
from app.models import (
    ConfigLocal,
    DevicePairingCode,
    EmployeeAuthPolicy,
    EmployeeProfile,
    EmployeeDevice,
    Ponto,
    PontoCorrectionConfig,
    JornadaValidationConfig,
    PontoTipo,
    PontoAdminAudit,
    PontoAdminAuditAction,
    User,
    UserRole,
)
from app.schemas import (
    AdminPontoCreate,
    AdminPontoDelete,
    AdminPontoUpdate,
    ConfigLocalOut,
    ConfigLocalUpsert,
    EmployeeCreate,
    EmployeeAuthPolicyOut,
    EmployeeAuthPolicyUpsert,
    DevicePairingCodeOut,
    EmployeeOut,
    JornadaValidationConfigOut,
    JornadaValidationConfigUpsert,
    JornadaDiaAdminOut,
    JornadaDiaOut,
    JornadaSegmentOut,
    PontoAdminOut,
    PontoAdminAuditOut,
    PontoAdminAuditPageOut,
    PontoCorrectionConfigOut,
    PontoCorrectionConfigUpsert,
    UserMe,
)


SP_TZ = ZoneInfo("America/Sao_Paulo")

_TIME_RE = re.compile(r"^(\d{2}):(\d{2})$")


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


def _sp_datetime_to_utc_naive(date_str: str, time_str: str) -> datetime:
    m = _TIME_RE.match(time_str)
    if not m:
        raise HTTPException(status_code=400, detail="Hora inválida. Use HH:MM")
    hh = int(m.group(1))
    mm = int(m.group(2))
    if hh < 0 or hh > 23 or mm < 0 or mm > 59:
        raise HTTPException(status_code=400, detail="Hora inválida. Use HH:MM")

    base = datetime.fromisoformat(date_str)
    dt_sp = base.replace(hour=hh, minute=mm, second=0, microsecond=0, tzinfo=SP_TZ)
    return dt_sp.astimezone(timezone.utc).replace(tzinfo=None)


def _get_correction_window_days(db: Session) -> int:
    row = db.query(PontoCorrectionConfig).filter(PontoCorrectionConfig.id == 1).first()
    if not row:
        row = PontoCorrectionConfig(id=1, window_days=30, updated_at=datetime.utcnow())
        db.add(row)
        db.commit()
        db.refresh(row)
    return int(row.window_days)


def _assert_within_correction_window(target_utc_naive: datetime, window_days: int) -> None:
    now_utc_naive = datetime.utcnow()
    min_dt = now_utc_naive - timedelta(days=window_days)
    max_dt = now_utc_naive + timedelta(days=1)
    if target_utc_naive < min_dt or target_utc_naive > max_dt:
        raise HTTPException(
            status_code=403,
            detail=f"Fora da janela de correção (configurada em {window_days} dias)",
        )


def _ponto_to_audit_snapshot(p: Ponto) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "tipo": p.tipo.value,
        "registrado_em": p.registrado_em.isoformat(),
        "lat": p.lat,
        "lng": p.lng,
        "accuracy_m": p.accuracy_m,
        "distancia_m": p.distancia_m,
    }


def _encode_audit_cursor(created_at_utc_naive: datetime, audit_id: int) -> str:
    raw = f"{created_at_utc_naive.isoformat()}|{audit_id}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_audit_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        padded = cursor + "=" * ((4 - (len(cursor) % 4)) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
        created_at_str, audit_id_str = raw.split("|", 1)
        created_at = datetime.fromisoformat(created_at_str)
        audit_id = int(audit_id_str)
        return created_at, audit_id
    except Exception:
        raise HTTPException(status_code=400, detail="Cursor inválido")


def _get_jornada_validation_config(db: Session) -> JornadaValidationConfig:
    row = db.query(JornadaValidationConfig).filter(JornadaValidationConfig.id == 1).first()
    if not row:
        row = JornadaValidationConfig(id=1, intervalo_exige_4_batidas_blocking=False, updated_at=datetime.utcnow())
        db.add(row)
        db.commit()
        db.refresh(row)
    return row

router = APIRouter(prefix="/admin", tags=["admin"])


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


@router.get("/me", response_model=UserMe)
def me(current_user: User = Depends(require_admin)):
    return UserMe(id=current_user.id, email=current_user.email, role=current_user.role.value)


@router.get("/funcionarios", response_model=list[EmployeeOut])
def list_employees(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    rows = (
        db.query(User, EmployeeProfile)
        .join(EmployeeProfile, EmployeeProfile.user_id == User.id)
        .filter(User.role == UserRole.employee)
        .order_by(User.id.desc())
        .limit(200)
        .all()
    )

    return [
        EmployeeOut(id=user.id, email=user.email, nome=profile.nome, is_active=user.is_active)
        for user, profile in rows
    ]


@router.post("/funcionarios", response_model=EmployeeOut)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role=UserRole.employee)
    db.add(user)
    db.flush()

    profile = EmployeeProfile(user_id=user.id, nome=payload.nome)
    db.add(profile)
    db.commit()
    db.refresh(user)

    return EmployeeOut(id=user.id, email=user.email, nome=profile.nome, is_active=user.is_active)


def _get_employee_policy(db: Session, employee_user_id: int) -> EmployeeAuthPolicy:
    row = db.query(EmployeeAuthPolicy).filter(EmployeeAuthPolicy.employee_user_id == employee_user_id).first()
    if row:
        return row
    row = EmployeeAuthPolicy(employee_user_id=employee_user_id, allow_password_login=True, allow_face_login=False)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/funcionarios/{employee_user_id}/auth-policy", response_model=EmployeeAuthPolicyOut)
def get_employee_auth_policy(
    employee_user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    employee = db.get(User, employee_user_id)
    if not employee or employee.role != UserRole.employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")

    row = _get_employee_policy(db, employee.id)
    return EmployeeAuthPolicyOut(
        allow_password_login=row.allow_password_login,
        allow_face_login=row.allow_face_login,
        updated_at=_utc_naive_to_sp(row.updated_at),
    )


@router.put("/funcionarios/{employee_user_id}/auth-policy", response_model=EmployeeAuthPolicyOut)
def upsert_employee_auth_policy(
    employee_user_id: int,
    payload: EmployeeAuthPolicyUpsert,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    employee = db.get(User, employee_user_id)
    if not employee or employee.role != UserRole.employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")

    row = _get_employee_policy(db, employee.id)
    row.allow_password_login = payload.allow_password_login
    row.allow_face_login = payload.allow_face_login
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return EmployeeAuthPolicyOut(
        allow_password_login=row.allow_password_login,
        allow_face_login=row.allow_face_login,
        updated_at=_utc_naive_to_sp(row.updated_at),
    )


@router.post("/funcionarios/{employee_user_id}/device-pairing-code", response_model=DevicePairingCodeOut)
def create_device_pairing_code(
    employee_user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    employee = db.get(User, employee_user_id)
    if not employee or employee.role != UserRole.employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")

    # Revoke any existing active device so only the new pairing can be used.
    now = datetime.utcnow()
    active_devices = (
        db.query(EmployeeDevice)
        .filter(EmployeeDevice.employee_user_id == employee.id)
        .filter(EmployeeDevice.revoked_at.is_(None))
        .all()
    )
    for d in active_devices:
        d.revoked_at = now

    code = secrets.token_urlsafe(9)
    expires_at = now + timedelta(minutes=10)

    row = DevicePairingCode(
        employee_user_id=employee.id,
        code_hash=hash_password(code),
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()
    return DevicePairingCodeOut(code=code, expires_at=_utc_naive_to_sp(expires_at))


@router.put("/config-local", response_model=ConfigLocalOut)
def upsert_config_local(
    payload: ConfigLocalUpsert,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    row = db.query(ConfigLocal).filter(ConfigLocal.id == 1).first()
    if not row:
        row = ConfigLocal(
            id=1,
            local_lat=payload.local_lat,
            local_lng=payload.local_lng,
            raio_m=payload.raio_m,
            updated_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        row.local_lat = payload.local_lat
        row.local_lng = payload.local_lng
        row.raio_m = payload.raio_m
        row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return ConfigLocalOut(
        local_lat=row.local_lat,
        local_lng=row.local_lng,
        raio_m=row.raio_m,
        updated_at=_utc_naive_to_sp(row.updated_at),
    )


@router.get("/pontos-correction-config", response_model=PontoCorrectionConfigOut)
def get_pontos_correction_config(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    row = db.query(PontoCorrectionConfig).filter(PontoCorrectionConfig.id == 1).first()
    if not row:
        row = PontoCorrectionConfig(id=1, window_days=30, updated_at=datetime.utcnow())
        db.add(row)
        db.commit()
        db.refresh(row)

    return PontoCorrectionConfigOut(window_days=row.window_days, updated_at=_utc_naive_to_sp(row.updated_at))


@router.put("/pontos-correction-config", response_model=PontoCorrectionConfigOut)
def upsert_pontos_correction_config(
    payload: PontoCorrectionConfigUpsert,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    row = db.query(PontoCorrectionConfig).filter(PontoCorrectionConfig.id == 1).first()
    if not row:
        row = PontoCorrectionConfig(id=1, window_days=payload.window_days, updated_at=datetime.utcnow())
        db.add(row)
    else:
        row.window_days = payload.window_days
        row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return PontoCorrectionConfigOut(window_days=row.window_days, updated_at=_utc_naive_to_sp(row.updated_at))


@router.get("/jornada-validation-config", response_model=JornadaValidationConfigOut)
def get_jornada_validation_config(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    row = _get_jornada_validation_config(db)
    return JornadaValidationConfigOut(
        intervalo_exige_4_batidas_blocking=bool(row.intervalo_exige_4_batidas_blocking),
        updated_at=_utc_naive_to_sp(row.updated_at),
    )


@router.put("/jornada-validation-config", response_model=JornadaValidationConfigOut)
def upsert_jornada_validation_config(
    payload: JornadaValidationConfigUpsert,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    row = db.query(JornadaValidationConfig).filter(JornadaValidationConfig.id == 1).first()
    if not row:
        row = JornadaValidationConfig(
            id=1,
            intervalo_exige_4_batidas_blocking=bool(payload.intervalo_exige_4_batidas_blocking),
            updated_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        row.intervalo_exige_4_batidas_blocking = bool(payload.intervalo_exige_4_batidas_blocking)
        row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return JornadaValidationConfigOut(
        intervalo_exige_4_batidas_blocking=bool(row.intervalo_exige_4_batidas_blocking),
        updated_at=_utc_naive_to_sp(row.updated_at),
    )


@router.get("/pontos", response_model=list[PontoAdminOut])
def list_pontos_admin(
    user_id: int,
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = (
        db.query(Ponto, User, EmployeeProfile)
        .join(User, User.id == Ponto.user_id)
        .outerjoin(EmployeeProfile, EmployeeProfile.user_id == User.id)
        .filter(Ponto.user_id == user_id)
    )

    if start:
        q = q.filter(Ponto.registrado_em >= _sp_date_to_utc_naive_start(start))
    if end:
        q = q.filter(Ponto.registrado_em < _sp_date_to_utc_naive_end_exclusive(end))

    rows = q.order_by(Ponto.registrado_em.desc()).limit(200).all()

    return [
        PontoAdminOut(
            id=p.id,
            user_id=u.id,
            email=u.email,
            nome=profile.nome if profile else u.email,
            tipo=p.tipo.value,
            registrado_em=_utc_naive_to_sp(p.registrado_em),
            lat=p.lat,
            lng=p.lng,
            accuracy_m=p.accuracy_m,
            distancia_m=p.distancia_m,
        )
        for p, u, profile in rows
    ]


@router.get("/pontos/last", response_model=PontoAdminOut)
def get_last_ponto_admin(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    row = (
        db.query(Ponto, User, EmployeeProfile)
        .join(User, User.id == Ponto.user_id)
        .outerjoin(EmployeeProfile, EmployeeProfile.user_id == User.id)
        .filter(Ponto.user_id == user_id)
        .order_by(Ponto.registrado_em.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Nenhum ponto encontrado para este funcionário")

    p, u, profile = row
    return PontoAdminOut(
        id=p.id,
        user_id=u.id,
        email=u.email,
        nome=profile.nome if profile else u.email,
        tipo=p.tipo.value,
        registrado_em=_utc_naive_to_sp(p.registrado_em),
        lat=p.lat,
        lng=p.lng,
        accuracy_m=p.accuracy_m,
        distancia_m=p.distancia_m,
    )


@router.get("/pontos/audit", response_model=PontoAdminAuditPageOut)
def list_pontos_audit(
    user_id: int | None = None,
    action: str | None = None,
    ponto_id: int | None = None,
    motivo_contains: str | None = None,
    start: str | None = None,
    end: str | None = None,
    limit: int = 200,
    cursor: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    limit = max(1, min(int(limit), 500))

    employee_u = aliased(User)
    admin_u = aliased(User)
    profile = aliased(EmployeeProfile)

    q = (
        db.query(PontoAdminAudit, employee_u, profile, admin_u)
        .join(employee_u, employee_u.id == PontoAdminAudit.employee_user_id)
        .outerjoin(profile, profile.user_id == employee_u.id)
        .join(admin_u, admin_u.id == PontoAdminAudit.admin_user_id)
    )

    if user_id is not None:
        q = q.filter(PontoAdminAudit.employee_user_id == user_id)

    if action:
        try:
            action_enum = PontoAdminAuditAction(action)
        except Exception:
            raise HTTPException(status_code=400, detail="Ação inválida")
        q = q.filter(PontoAdminAudit.action == action_enum)

    if ponto_id is not None:
        q = q.filter(PontoAdminAudit.ponto_id == ponto_id)

    if motivo_contains:
        termo = motivo_contains.strip()
        if termo:
            q = q.filter(PontoAdminAudit.motivo.ilike(f"%{termo}%"))
    if start:
        q = q.filter(PontoAdminAudit.created_at >= _sp_date_to_utc_naive_start(start))
    if end:
        q = q.filter(PontoAdminAudit.created_at < _sp_date_to_utc_naive_end_exclusive(end))

    if cursor:
        cursor_created_at, cursor_id = _decode_audit_cursor(cursor)
        q = q.filter(
            (PontoAdminAudit.created_at < cursor_created_at)
            | ((PontoAdminAudit.created_at == cursor_created_at) & (PontoAdminAudit.id < cursor_id))
        )

    rows = q.order_by(PontoAdminAudit.created_at.desc(), PontoAdminAudit.id.desc()).limit(limit).all()

    out_items: list[PontoAdminAuditOut] = []
    for audit, emp, emp_profile, adm in rows:
        before = None
        after = None
        try:
            if audit.before_json:
                before = json.loads(audit.before_json)
        except Exception:
            before = None
        try:
            if audit.after_json:
                after = json.loads(audit.after_json)
        except Exception:
            after = None

        out_items.append(
            PontoAdminAuditOut(
                id=audit.id,
                action=audit.action.value,
                ponto_id=audit.ponto_id,
                employee_user_id=emp.id,
                employee_email=emp.email,
                employee_nome=emp_profile.nome if emp_profile else emp.email,
                admin_user_id=adm.id,
                admin_email=adm.email,
                motivo=audit.motivo,
                before=before,
                after=after,
                created_at=_utc_naive_to_sp(audit.created_at),
            )
        )

    next_cursor = None
    if len(rows) == limit:
        last_audit = rows[-1][0]
        next_cursor = _encode_audit_cursor(last_audit.created_at, last_audit.id)

    return PontoAdminAuditPageOut(items=out_items, next_cursor=next_cursor)


@router.post("/pontos", response_model=PontoAdminOut)
def admin_create_ponto(
    payload: AdminPontoCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    employee = db.get(User, payload.user_id)
    if not employee or employee.role != UserRole.employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")

    target_dt = _sp_datetime_to_utc_naive(payload.date, payload.time)
    window_days = _get_correction_window_days(db)
    _assert_within_correction_window(target_dt, window_days)

    row = Ponto(
        user_id=employee.id,
        tipo=PontoTipo(payload.tipo),
        registrado_em=target_dt,
        lat=payload.lat,
        lng=payload.lng,
        accuracy_m=payload.accuracy_m,
        distancia_m=payload.distancia_m,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    audit = PontoAdminAudit(
        action=PontoAdminAuditAction.create,
        ponto_id=row.id,
        employee_user_id=employee.id,
        admin_user_id=admin_user.id,
        motivo=payload.motivo,
        before_json=None,
        after_json=json.dumps(_ponto_to_audit_snapshot(row), ensure_ascii=False),
    )
    db.add(audit)
    db.commit()

    profile = db.query(EmployeeProfile).filter(EmployeeProfile.user_id == employee.id).first()
    return PontoAdminOut(
        id=row.id,
        user_id=employee.id,
        email=employee.email,
        nome=profile.nome if profile else employee.email,
        tipo=row.tipo.value,
        registrado_em=_utc_naive_to_sp(row.registrado_em),
        lat=row.lat,
        lng=row.lng,
        accuracy_m=row.accuracy_m,
        distancia_m=row.distancia_m,
    )


@router.put("/pontos/{ponto_id}", response_model=PontoAdminOut)
def admin_update_ponto(
    ponto_id: int,
    payload: AdminPontoUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    row = db.get(Ponto, ponto_id)
    if not row:
        raise HTTPException(status_code=404, detail="Ponto não encontrado")

    employee = db.get(User, row.user_id)
    if not employee or employee.role != UserRole.employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")

    before = _ponto_to_audit_snapshot(row)

    target_dt = _sp_datetime_to_utc_naive(payload.date, payload.time)
    window_days = _get_correction_window_days(db)
    _assert_within_correction_window(target_dt, window_days)

    row.tipo = PontoTipo(payload.tipo)
    row.registrado_em = target_dt
    row.lat = payload.lat
    row.lng = payload.lng
    row.accuracy_m = payload.accuracy_m
    row.distancia_m = payload.distancia_m

    db.commit()
    db.refresh(row)

    audit = PontoAdminAudit(
        action=PontoAdminAuditAction.update,
        ponto_id=row.id,
        employee_user_id=employee.id,
        admin_user_id=admin_user.id,
        motivo=payload.motivo,
        before_json=json.dumps(before, ensure_ascii=False),
        after_json=json.dumps(_ponto_to_audit_snapshot(row), ensure_ascii=False),
    )
    db.add(audit)
    db.commit()

    profile = db.query(EmployeeProfile).filter(EmployeeProfile.user_id == employee.id).first()
    return PontoAdminOut(
        id=row.id,
        user_id=employee.id,
        email=employee.email,
        nome=profile.nome if profile else employee.email,
        tipo=row.tipo.value,
        registrado_em=_utc_naive_to_sp(row.registrado_em),
        lat=row.lat,
        lng=row.lng,
        accuracy_m=row.accuracy_m,
        distancia_m=row.distancia_m,
    )


@router.delete("/pontos/{ponto_id}")
def admin_delete_ponto(
    ponto_id: int,
    payload: AdminPontoDelete,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    row = db.get(Ponto, ponto_id)
    if not row:
        raise HTTPException(status_code=404, detail="Ponto não encontrado")

    employee = db.get(User, row.user_id)
    if not employee or employee.role != UserRole.employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")

    window_days = _get_correction_window_days(db)
    _assert_within_correction_window(row.registrado_em, window_days)

    before = _ponto_to_audit_snapshot(row)
    db.delete(row)
    db.commit()

    audit = PontoAdminAudit(
        action=PontoAdminAuditAction.delete,
        ponto_id=ponto_id,
        employee_user_id=employee.id,
        admin_user_id=admin_user.id,
        motivo=payload.motivo,
        before_json=json.dumps(before, ensure_ascii=False),
        after_json=None,
    )
    db.add(audit)
    db.commit()

    return {"ok": True}


@router.get("/jornada", response_model=JornadaDiaAdminOut)
def jornada_do_dia_admin(
    user_id: int,
    date: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user or user.role != UserRole.employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")

    profile = db.query(EmployeeProfile).filter(EmployeeProfile.user_id == user.id).first()

    start_dt = _sp_date_to_utc_naive_start(date)
    end_dt = _sp_date_to_utc_naive_end_exclusive(date)
    pontos = (
        db.query(Ponto)
        .filter(Ponto.user_id == user.id)
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

    return JornadaDiaAdminOut(
        user_id=user.id,
        email=user.email,
        nome=profile.nome if profile else user.email,
        data=date,
        total_trabalhado_segundos=total_s,
        total_trabalhado_hhmm=_fmt_hhmm(total_s),
        segmentos=segmentos,
        alertas=alertas,
    )
