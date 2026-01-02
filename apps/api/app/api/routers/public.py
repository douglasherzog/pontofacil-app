from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db.deps import get_db
from app.models import ConfigLocal, DevicePairingCode, EmployeeDevice, User, UserRole
from app.schemas import ConfigLocalOut, PairDeviceRequest, PairDeviceResponse


SP_TZ = ZoneInfo("America/Sao_Paulo")


def _utc_naive_to_sp(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).astimezone(SP_TZ)

router = APIRouter(tags=["public"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/config-local", response_model=ConfigLocalOut | None)
def get_config_local(db: Session = Depends(get_db)):
    row = db.query(ConfigLocal).filter(ConfigLocal.id == 1).first()
    if not row:
        return None
    return ConfigLocalOut(
        local_lat=row.local_lat,
        local_lng=row.local_lng,
        raio_m=row.raio_m,
        updated_at=_utc_naive_to_sp(row.updated_at),
    )


@router.post("/pair-device", response_model=PairDeviceResponse)
def pair_device(payload: PairDeviceRequest, db: Session = Depends(get_db)):
    now = datetime.utcnow()

    # Since we store only a hash, we need to find candidates not expired and verify.
    candidates = (
        db.query(DevicePairingCode)
        .filter(DevicePairingCode.expires_at > now)
        .filter(DevicePairingCode.consumed_at.is_(None))
        .order_by(DevicePairingCode.id.desc())
        .limit(50)
        .all()
    )

    matched: DevicePairingCode | None = None
    for c in candidates:
        if verify_password(payload.code, c.code_hash):
            matched = c
            break

    if not matched:
        raise HTTPException(status_code=404, detail="QR code inválido ou expirado")

    employee = db.get(User, matched.employee_user_id)
    if not employee or employee.role != UserRole.employee or not employee.is_active:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")

    # Enforce 1 active device per employee: revoke any previous.
    prev_devices = (
        db.query(EmployeeDevice)
        .filter(EmployeeDevice.employee_user_id == employee.id)
        .filter(EmployeeDevice.revoked_at.is_(None))
        .all()
    )
    for d in prev_devices:
        d.revoked_at = now

    device_secret = secrets.token_urlsafe(32)

    row = EmployeeDevice(
        employee_user_id=employee.id,
        device_id=payload.device_id,
        device_name=payload.device_name,
        device_secret_hash=hash_password(device_secret),
    )
    db.add(row)

    matched.consumed_at = now
    matched.consumed_by_device_id = payload.device_id

    db.commit()

    return PairDeviceResponse(device_secret=device_secret, employee_user_id=employee.id)
