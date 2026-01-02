import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    employee = "employee"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.employee, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employee_profile: Mapped["EmployeeProfile"] = relationship(back_populates="user", uselist=False)


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    nome: Mapped[str] = mapped_column(String(255))
    genero: Mapped[str | None] = mapped_column(String(16), nullable=True)

    user: Mapped[User] = relationship(back_populates="employee_profile")


class EmployeeAuthPolicy(Base):
    __tablename__ = "employee_auth_policy"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    employee_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    allow_password_login: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_face_login: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EmployeeDevice(Base):
    __tablename__ = "employee_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    device_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device_secret_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class DevicePairingCode(Base):
    __tablename__ = "device_pairing_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    code_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    consumed_by_device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)


class PontoTipo(str, enum.Enum):
    entrada = "entrada"
    saida = "saida"
    intervalo_inicio = "intervalo_inicio"
    intervalo_fim = "intervalo_fim"


class Ponto(Base):
    __tablename__ = "pontos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    tipo: Mapped[PontoTipo] = mapped_column(Enum(PontoTipo))
    registrado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    distancia_m: Mapped[float | None] = mapped_column(Float, nullable=True)


class ConfigLocal(Base):
    __tablename__ = "config_local"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    local_lat: Mapped[float] = mapped_column(Float)
    local_lng: Mapped[float] = mapped_column(Float)
    raio_m: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PontoCorrectionConfig(Base):
    __tablename__ = "ponto_correction_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    window_days: Mapped[int] = mapped_column(Integer, default=30)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PontoAdminAuditAction(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"


class PontoAdminAudit(Base):
    __tablename__ = "ponto_admin_audit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action: Mapped[PontoAdminAuditAction] = mapped_column(Enum(PontoAdminAuditAction), index=True)

    ponto_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    employee_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    admin_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    motivo: Mapped[str] = mapped_column(String(500))
    before_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class JornadaValidationConfig(Base):
    __tablename__ = "jornada_validation_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    intervalo_exige_4_batidas_blocking: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
