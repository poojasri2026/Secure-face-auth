"""Application configuration.

All configuration comes from environment variables (see backend/.env.example).
Secrets are NEVER hard-coded here. Thresholds for face matching and liveness are
configurable so they are not scattered as magic numbers across the codebase.
"""
from __future__ import annotations

import base64
import hashlib
from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ----
    APP_NAME: str = "Secure Face Auth"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api"

    # ---- Database ----
    DATABASE_URL: str = "postgresql+asyncpg://mfa:mfa@localhost:5432/mfa"
    AUTO_CREATE_TABLES: bool = True
    SQL_ECHO: bool = False

    # ---- JWT ----
    JWT_SECRET_KEY: str = "dev-insecure-access-secret-change-me"
    JWT_REFRESH_SECRET_KEY: str = "dev-insecure-refresh-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENROLL_TOKEN_EXPIRE_MINUTES: int = 20
    MFA_SESSION_TTL_SECONDS: int = 600

    # ---- OTP ----
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_PEPPER: str = "dev-insecure-otp-pepper-change-me"

    # ---- Face / biometrics ----
    FACE_MATCH_THRESHOLD: float = 0.45           # cosine similarity threshold
    FACE_MIN_DET_SCORE: float = 0.55             # detector confidence
    FACE_MIN_BOX_RATIO: float = 0.10             # face box area / image area
    FACE_ENROLL_MIN_SAMPLES: int = 3
    FACE_EMBEDDING_DIM: int = 512
    INSIGHTFACE_MODEL: str = "buffalo_l"
    INSIGHTFACE_CTX_ID: int = -1                 # -1 = CPU, >=0 = GPU id
    INSIGHTFACE_DET_SIZE: int = 640
    FACE_EMBEDDING_ENCRYPTION_KEY: Optional[str] = None

    # ---- Liveness ----
    LIVENESS_THRESHOLD: float = 0.50
    LIVENESS_CHALLENGE_COUNT: int = 1         # blink only
    LIVENESS_SESSION_TTL_SECONDS: int = 120
    LIVENESS_PER_CHALLENGE_TIMEOUT_SECONDS: int = 10
    LIVENESS_MAX_FAILED_ATTEMPTS: int = 4
    LIVENESS_MIN_SAMPLES: int = 3
    EAR_CLOSED_THRESHOLD: float = 0.24
    EAR_OPEN_THRESHOLD: float = 0.26
    HEAD_YAW_THRESHOLD_DEG: float = 7.0
    HEAD_PITCH_THRESHOLD_DEG: float = 6.0
    HEAD_ROLL_THRESHOLD_DEG: float = 6.5

    # ---- SMTP ----
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_USE_TLS: bool = True
    SMTP_TIMEOUT_SECONDS: int = 15

    # ---- Security / cookies / CORS ----
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: Optional[str] = None
    COOKIE_SAMESITE: str = "lax"
    REFRESH_COOKIE_NAME: str = "mfa_refresh_token"
    MAX_REQUEST_BYTES: int = 8 * 1024 * 1024
    LOGIN_MAX_FAILED_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15
    RATE_LIMIT_PER_MINUTE: int = 60

    # ---- Bootstrap admin ----
    BOOTSTRAP_ADMIN_EMAIL: Optional[str] = None
    BOOTSTRAP_ADMIN_PASSWORD: Optional[str] = None
    BOOTSTRAP_ADMIN_NAME: str = "Administrator"

    # ---------------------------------------------------------------
    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def database_url_sync(self) -> str:
        """Sync driver URL for Alembic (swap asyncpg -> psycopg2, aiosqlite -> sqlite)."""
        url = self.DATABASE_URL
        return (
            url.replace("+asyncpg", "+psycopg2")
            .replace("+aiosqlite", "")
        )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod"}

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USERNAME and self.SMTP_PASSWORD)

    @property
    def fernet_key(self) -> bytes:
        """Return a valid urlsafe-base64 32-byte Fernet key.

        If FACE_EMBEDDING_ENCRYPTION_KEY is not provided we derive one
        deterministically from JWT_SECRET_KEY. That keeps dev restarts working,
        but production MUST set a dedicated key.
        """
        if self.FACE_EMBEDDING_ENCRYPTION_KEY:
            key = self.FACE_EMBEDDING_ENCRYPTION_KEY.strip()
            # Accept either a proper Fernet key or any string we can normalise.
            try:
                if len(base64.urlsafe_b64decode(key)) == 32:
                    return key.encode()
            except Exception:
                pass
            digest = hashlib.sha256(key.encode()).digest()
            return base64.urlsafe_b64encode(digest)
        digest = hashlib.sha256(("face-enc::" + self.JWT_SECRET_KEY).encode()).digest()
        return base64.urlsafe_b64encode(digest)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
