from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserMe(BaseModel):
    id: int
    email: EmailStr
    role: Literal["admin", "employee"]


class EmployeeCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    nome: str = Field(min_length=1)


class EmployeeOut(BaseModel):
    id: int
    email: EmailStr
    nome: str
    is_active: bool


class EmployeeAuthPolicyUpsert(BaseModel):
    allow_password_login: bool
    allow_face_login: bool


class EmployeeAuthPolicyOut(EmployeeAuthPolicyUpsert):
    updated_at: datetime


class DevicePairingCodeOut(BaseModel):
    code: str
    expires_at: datetime


class EmployeeDeviceOut(BaseModel):
    device_id: str
    device_name: str | None
    created_at: datetime


class PairDeviceRequest(BaseModel):
    code: str = Field(min_length=8)
    device_id: str = Field(min_length=8, max_length=128)
    device_name: str | None = Field(default=None, max_length=255)


class PairDeviceResponse(BaseModel):
    device_secret: str
    employee_user_id: int


class DeviceLoginRequest(BaseModel):
    device_id: str
    device_secret: str


class ConfigLocalUpsert(BaseModel):
    local_lat: float
    local_lng: float
    raio_m: int = Field(gt=0)


class ConfigLocalOut(BaseModel):
    local_lat: float
    local_lng: float
    raio_m: int
    updated_at: datetime


class PontoCorrectionConfigOut(BaseModel):
    window_days: int
    updated_at: datetime


class PontoCorrectionConfigUpsert(BaseModel):
    window_days: int = Field(gt=0)


class JornadaValidationConfigOut(BaseModel):
    intervalo_exige_4_batidas_blocking: bool
    updated_at: datetime


class JornadaValidationConfigUpsert(BaseModel):
    intervalo_exige_4_batidas_blocking: bool


PontoTipo = Literal["entrada", "saida", "intervalo_inicio", "intervalo_fim"]


class PontoCreate(BaseModel):
    tipo: PontoTipo
    lat: float
    lng: float
    accuracy_m: float | None = None
    distancia_m: float | None = None


class PontoAutoCreate(BaseModel):
    lat: float
    lng: float
    accuracy_m: float | None = None


class PontoOut(BaseModel):
    id: int
    tipo: PontoTipo
    registrado_em: datetime
    lat: float
    lng: float
    accuracy_m: float | None
    distancia_m: float | None


class PontoAdminOut(PontoOut):
    user_id: int
    email: EmailStr
    nome: str


class AdminPontoCreate(BaseModel):
    user_id: int
    tipo: PontoTipo
    date: str
    time: str
    lat: float = 0.0
    lng: float = 0.0
    accuracy_m: float | None = None
    distancia_m: float | None = None
    motivo: str = Field(min_length=3, max_length=500)


class AdminPontoUpdate(BaseModel):
    tipo: PontoTipo
    date: str
    time: str
    lat: float
    lng: float
    accuracy_m: float | None = None
    distancia_m: float | None = None
    motivo: str = Field(min_length=3, max_length=500)


class AdminPontoDelete(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)


PontoAdminAuditAction = Literal["create", "update", "delete"]


class PontoAdminAuditOut(BaseModel):
    id: int
    action: PontoAdminAuditAction
    ponto_id: int | None
    employee_user_id: int
    employee_email: EmailStr
    employee_nome: str
    admin_user_id: int
    admin_email: EmailStr
    motivo: str
    before: dict | None
    after: dict | None
    created_at: datetime


class PontoAdminAuditPageOut(BaseModel):
    items: list[PontoAdminAuditOut]
    next_cursor: str | None


JornadaSegmentTipo = Literal["trabalho", "intervalo"]


class JornadaSegmentOut(BaseModel):
    tipo: JornadaSegmentTipo
    inicio: datetime
    fim: datetime
    segundos: int


class JornadaDiaOut(BaseModel):
    data: str
    total_trabalhado_segundos: int
    total_trabalhado_hhmm: str
    segmentos: list[JornadaSegmentOut]
    alertas: list[str]


class JornadaDiaAdminOut(JornadaDiaOut):
    user_id: int
    email: EmailStr
    nome: str
