from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.deps import get_db
from app.models import EmployeeAuthPolicy, EmployeeDevice, User, UserRole
from app.schemas import DeviceLoginRequest, LoginRequest, Token

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_employee_policy(db: Session, employee_user_id: int) -> EmployeeAuthPolicy:
    row = db.query(EmployeeAuthPolicy).filter(EmployeeAuthPolicy.employee_user_id == employee_user_id).first()
    if row:
        return row
    row = EmployeeAuthPolicy(employee_user_id=employee_user_id, allow_password_login=True, allow_face_login=False)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    if user.role == UserRole.employee:
        policy = _get_employee_policy(db, user.id)
        if not policy.allow_password_login:
            raise HTTPException(status_code=403, detail="Login por senha desabilitado para este funcionário")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return Token(access_token=token)


@router.post("/device-login", response_model=Token)
def device_login(payload: DeviceLoginRequest, db: Session = Depends(get_db)):
    device = db.query(EmployeeDevice).filter(EmployeeDevice.device_id == payload.device_id).first()
    if not device or device.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Dispositivo não cadastrado")

    user = db.get(User, device.employee_user_id)
    if not user or not user.is_active or user.role != UserRole.employee:
        raise HTTPException(status_code=401, detail="Dispositivo não cadastrado")

    policy = _get_employee_policy(db, user.id)
    if not policy.allow_face_login:
        raise HTTPException(status_code=403, detail="Login por reconhecimento facial desabilitado para este funcionário")

    if not verify_password(payload.device_secret, device.device_secret_hash):
        raise HTTPException(status_code=401, detail="Dispositivo não cadastrado")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return Token(access_token=token)
