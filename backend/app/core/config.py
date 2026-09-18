from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, sourced from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Turf Manager API"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://turf:turf@localhost:5433/turfmanager"

    jwt_secret: str = "change-me-in-production-please"
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
