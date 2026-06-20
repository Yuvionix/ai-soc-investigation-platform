"""Application configuration — fixed env_file path + added credential fields."""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List

def _find_env() -> str:
    """Find .env regardless of which directory uvicorn is run from."""
    here = Path(__file__).resolve()
    for parent in [here.parent.parent.parent, here.parent.parent, Path.cwd()]:
        candidate = parent / ".env"
        if candidate.exists():
            return str(candidate)
    return ".env"

class Settings(BaseSettings):
    # Application
    APP_NAME:    str  = "Offline SOC Dashboard"
    DEBUG:       bool = True
    ENVIRONMENT: str  = "development"

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # Database
    DATABASE_URL: str = "sqlite:///./data/soc_database.db"

    # Security
    SECRET_KEY:             str  = "soc-default-secret-key-change-in-production"
    ENCRYPTION_KEY:         str  = "soc-default-encryption-key-change-in-prod"
    ENABLE_ENCRYPTION:      bool = True
    ENABLE_INTEGRITY_CHECK: bool = True
    HASH_ALGORITHM:         str  = "sha256"

    # ── USER CREDENTIALS (were missing — this was the login bug) ──────────────
    SOC_ADMIN_PASSWORD:   str = "Admin@123"
    SOC_ANALYST_PASSWORD: str = "Analyst@123"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000", "http://localhost:8000",
        "http://127.0.0.1:3000", "http://127.0.0.1:8000",
    ]

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE:  str = "logs/app.log"

    # Simulation
    REPLAY_SPEED:            float = 1.0
    MAX_EVENTS_PER_SCENARIO: int   = 10000

    # Pagination
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE:     int = 1000

    class Config:
        env_file       = _find_env()
        case_sensitive = True
        extra          = "ignore"

settings = Settings()
