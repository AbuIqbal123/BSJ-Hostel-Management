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
    database_path: Path = BACKEND_ROOT / "data" / "hostel.db"
    turso_database_url: str = ""
    turso_auth_token: str = ""
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


def is_hosted() -> bool:
    """Render sets RENDER=true. Every other process uses the local SQLite file."""
    return os.environ.get("RENDER", "").strip().lower() == "true"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.reject_unsafe_sms()
    settings.reject_unsafe_push()
    settings.reject_missing_secret()
    return settings
