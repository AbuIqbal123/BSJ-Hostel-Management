import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    debug: bool = False
    # None means on in development and off in production. Set DOCS_ENABLED to override.
    docs_enabled: bool | None = None
    cors_origins: str = ""
    database_path: Path = BACKEND_ROOT / "data" / "hostel.db"
    turso_database_url: str = ""
    turso_auth_token: str = ""
    turso_timeout_seconds: float = 5
    payment_evidence_dir: Path = BACKEND_ROOT / "data" / "payment-evidence"
    sqlite_busy_timeout_ms: int = 5000
    sms_driver: str = "mock"
    push_driver: str = "mock"
    expo_access_token: str = ""
    app_secret_key: str = ""
    # Local `python -m app.dev_seed` only.
    bsj_seed_password: str = ""
    bsj_seed_password_gate: str = ""
    bsj_seed_password_resident: str = ""
    bsj_seed_password_suspended: str = ""
    bsj_seed_password_warden: str = ""
    bsj_seed_password_provost: str = ""

    def reject_unsafe_sms(self) -> None:
        if self.sms_driver not in {"mock", "dlt"}:
            raise RuntimeError(f"Unsupported SMS_DRIVER: {self.sms_driver}")
        if self.environment != "production" and self.sms_driver != "mock":
            raise RuntimeError(
                "SMS_DRIVER must be mock when ENVIRONMENT is not production. "
                "Refusing to start so this process cannot send parent SMS."
            )

    def reject_unsafe_push(self) -> None:
        if self.push_driver not in {"mock", "expo"}:
            raise RuntimeError(f"Unsupported PUSH_DRIVER: {self.push_driver}")
        if self.environment != "production" and self.push_driver != "mock":
            raise RuntimeError(
                "PUSH_DRIVER must be mock when ENVIRONMENT is not production. "
                "Refusing to start so this process cannot push to phones."
            )

    def reject_missing_secret(self) -> None:
        key = self.app_secret_key.strip()
        if not key:
            raise RuntimeError(
                "APP_SECRET_KEY is empty. Set it in the untracked backend/.env. "
                "Refusing to start."
            )
        if len(key.encode("utf-8")) < 32:
            raise RuntimeError(
                "APP_SECRET_KEY must be at least 32 bytes so JWT HS256 signing "
                "meets the recommended key length. Refusing to start."
            )

    def reject_unsafe_hosting(self) -> None:
        """Production and Render refuse a debug process, a wildcard, a known key, or a file database."""
        if self.turso_timeout_seconds <= 0:
            raise RuntimeError("TURSO_TIMEOUT_SECONDS must be greater than zero. Refusing to start.")
        hosted = is_hosted()
        if self.environment != "production" and not hosted:
            return
        reasons: list[str] = []
        if self.debug:
            reasons.append("DEBUG is on")
        origins = [part.strip() for part in self.cors_origins.split(",") if part.strip()]
        if "*" in origins:
            reasons.append("CORS_ORIGINS contains a wildcard")
        if self.app_secret_key.strip() in _DEFAULT_SECRETS:
            reasons.append("APP_SECRET_KEY is a default value")
        if hosted and os.environ.get("DATABASE_PATH", "").strip():
            reasons.append("DATABASE_PATH is set and the hosted hall keeps records on Turso")
        if hosted:
            url = self.turso_database_url.strip().lower()
            if url.startswith(("file:", "sqlite:")):
                reasons.append(
                    "TURSO_DATABASE_URL is a file URL. Refusing to open a database file"
                )
        if reasons:
            raise RuntimeError("Refusing to start. " + ". ".join(reasons) + ".")


_DEFAULT_SECRETS = frozenset(
    {
        "changeme",
        "change-me",
        "secret",
        "password",
        "hall-test-signing-key-0123456789abcdef",
    }
)


def is_hosted() -> bool:
    """Render sets RENDER=true. Every other process uses the local SQLite file."""
    return os.environ.get("RENDER", "").strip().lower() == "true"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.docs_enabled is None:
        settings.docs_enabled = settings.environment != "production"
    settings.reject_unsafe_sms()
    settings.reject_unsafe_push()
    settings.reject_missing_secret()
    settings.reject_unsafe_hosting()
    return settings
