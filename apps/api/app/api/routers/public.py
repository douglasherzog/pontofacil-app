from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.models import ConfigLocal
from app.schemas import ConfigLocalOut


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
