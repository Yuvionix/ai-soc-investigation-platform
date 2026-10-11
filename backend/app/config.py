"""Application configuration — fixed env_file path + added credential fields."""
import logging
import secrets
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List

logger = logging.getLogger("soc_dashboard.config")

# Placeholder values shipped in the repo. They are public, so they must never be
# used outside local development.
_DEFAULT_SECRET_KEY       = "soc-default-secret-key-change-in-production"
_DEFAULT_ENCRYPTION_KEY   = "soc-default-encryption-key-change-in-prod"
_DEFAULT_ADMIN_PASSWORD   = "Admin@123"
_DEFAULT_ANALYST_PASSWORD = "Analyst@123"

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
    DEBUG:       bool = False
    ENVIRONMENT: str  = "development"

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # Database
    DATABASE_URL: str = "sqlite:///./data/soc_database.db"

    # Security
    SECRET_KEY:             str  = _DEFAULT_SECRET_KEY
    ENCRYPTION_KEY:         str  = _DEFAULT_ENCRYPTION_KEY
    ENABLE_ENCRYPTION:      bool = True
    ENABLE_INTEGRITY_CHECK: bool = True
    HASH_ALGORITHM:         str  = "sha256"

    # ── USER CREDENTIALS (were missing — this was the login bug) ──────────────
    SOC_ADMIN_PASSWORD:   str = _DEFAULT_ADMIN_PASSWORD
    SOC_ANALYST_PASSWORD: str = _DEFAULT_ANALYST_PASSWORD

    # Login brute-force protection
    LOGIN_MAX_ATTEMPTS:    int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

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


def _harden(s: Settings) -> None:
    """
    SECURITY FIX: refuse to run outside development with the publicly known
    placeholder secrets / passwords, and never sign JWTs with the repo default.
    """
    insecure = []
    if s.SECRET_KEY == _DEFAULT_SECRET_KEY or len(s.SECRET_KEY) < 32:
        insecure.append("SECRET_KEY")
    if s.ENCRYPTION_KEY == _DEFAULT_ENCRYPTION_KEY:
        insecure.append("ENCRYPTION_KEY")
    if s.SOC_ADMIN_PASSWORD == _DEFAULT_ADMIN_PASSWORD:
        insecure.append("SOC_ADMIN_PASSWORD")
    if s.SOC_ANALYST_PASSWORD == _DEFAULT_ANALYST_PASSWORD:
        insecure.append("SOC_ANALYST_PASSWORD")

    if insecure and s.ENVIRONMENT.lower() != "development":
        raise RuntimeError(
            "Refusing to start: insecure default value(s) for "
            + ", ".join(insecure)
            + ". Set them in .env, or set ENVIRONMENT=development for local use."
        )

    if "SECRET_KEY" in insecure:
        # Development only: use an ephemeral random key instead of the public
        # placeholder so tokens can't be forged. Tokens reset on restart.
        s.SECRET_KEY = secrets.token_urlsafe(64)
    if insecure:
        logger.warning("Using development defaults for: %s", ", ".join(insecure))


_harden(settings)
