from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api.routers import admin, auth, pontos, public
from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import User, UserRole

from sqlalchemy import text

app = FastAPI(title="PontoFacil API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(pontos.router)


@app.get("/")
def root():
    return RedirectResponse(url="/docs")


def ensure_admin(db: Session) -> None:
    user = db.query(User).filter(User.email == settings.admin_email).first()
    if user:
        return

    admin_user = User(
        email=settings.admin_email,
        password_hash=hash_password(settings.admin_password),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(admin_user)
    db.commit()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE employee_profiles ADD COLUMN genero VARCHAR(16)"))
    except Exception:
        pass
    db = SessionLocal()
    try:
        ensure_admin(db)
    finally:
        db.close()
