"""Core configuration settings."""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "TensorPilot"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"  # development, staging, production
    demo_mode: bool = True

    # Server
    host: str = "127.0.0.1"
    port: int = 8000
    workers: int = 1

    # Database
    database_url: str = "sqlite+aiosqlite:///./tensorpilot.db"
    database_echo: bool = False

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "RS256"

    # OIDC / Keycloak
    oidc_enabled: bool = True
    oidc_issuer_url: str = "http://localhost:8080/realms/tensorpilot"
    oidc_client_id: str = "tensorpilot-backend"
    oidc_client_secret: Optional[str] = None
    oidc_audience: str = "tensorpilot-api"
    oidc_jwks_uri: Optional[str] = None

    # Frontend URL (for CORS)
    frontend_url: str = "http://localhost:5173"

    # LLM / VoxCPM2
    llm_api_key: Optional[str] = None
    llm_provider: str = "openai-compatible"  # openai-compatible, anthropic, gemini, ollama
    llm_model: str = "voxcpm2"
    llm_base_url: Optional[str] = None
    voxcpm_model_path: Optional[str] = None
    voxcpm_device: str = "cuda"  # cuda, cpu, mps

    # Redis (for caching, rate limiting)
    redis_url: Optional[str] = None

    # File storage
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 50

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"  # json, console


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()