from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Environment for this process.

    Production on the VPS sets DATABASE_PATH to the persistent volume.
    A non-production process is refused unless SMS_DRIVER is mock.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    database_path: Path = BACKEND_ROOT / "data" / "hostel.db"
    sqlite_busy_timeout_ms: int = 5000
    sms_driver: str = "mock"
    app_secret_key: str = ""

    def reject_unsafe_sms(self) -> None:
        if self.sms_driver not in {"mock", "dlt"}:
            raise RuntimeError(f"Unsupported SMS_DRIVER: {self.sms_driver}")
        if self.environment != "production" and self.sms_driver != "mock":
            raise RuntimeError(
                "SMS_DRIVER must be mock when ENVIRONMENT is not production. "
                "Refusing to start so this process cannot send parent SMS."
            )

    def reject_missing_secret(self) -> None:
        if not self.app_secret_key.strip():
            raise RuntimeError(
                "APP_SECRET_KEY is empty. Set it in the untracked backend/.env. "
                "Refusing to start."
            )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.reject_unsafe_sms()
    settings.reject_missing_secret()
    return settings
