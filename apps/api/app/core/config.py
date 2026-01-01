from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


API_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = (API_DIR / "app.db").as_posix()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PONTOFACIL_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = f"sqlite:///{DEFAULT_DB_PATH}"

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60 * 24

    admin_email: str = "admin@local.com"
    admin_password: str = "admin"


settings = Settings()
