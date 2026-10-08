from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_JWT_SECRET = "change-me-in-production-please"


class Settings(BaseSettings):
    """Application configuration, sourced from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Turf Manager API"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://turf:turf@localhost:5433/turfmanager"

    jwt_secret: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Both PWAs, in dev and previewed-build form. Requests through each app's own Vite
    # dev proxy never hit CORS at all — this only matters if something calls the API
    # cross-origin directly (a preview build, or a future mobile app's web view).
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:5174",
        "http://localhost:4174",
    ]

    default_timezone: str = "Asia/Dhaka"
    default_currency: str = "BDT"

    log_level: str = "INFO"
    # Optional: set to report unhandled errors to Sentry (or any Sentry-compatible
    # service such as GlitchTip). Empty means errors only go to the container logs.
    sentry_dsn: str = ""

    # Failed logins allowed per phone number (and per client IP) inside the window
    # before the login endpoint starts answering 429.
    login_max_failures: int = 10
    login_failure_window_minutes: int = 15

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @model_validator(mode="after")
    def _refuse_insecure_production_config(self) -> "Settings":
        """Fail at startup, loudly, rather than run production with a guessable secret."""
        if self.is_production:
            if self.jwt_secret == _DEFAULT_JWT_SECRET or "change-me" in self.jwt_secret or len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be set to a random string of 32+ characters in production.")
            if any(o.startswith("http://localhost") for o in self.cors_origins):
                raise ValueError("CORS_ORIGINS still lists localhost origins — set the real domains in production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
