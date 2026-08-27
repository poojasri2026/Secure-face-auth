"""Security primitives: password hashing, OTP hashing, JWT, embedding encryption.

- Passwords: Argon2id (argon2-cffi).
- OTPs: HMAC-SHA256 with a server pepper (never stored in plain text).
- Access tokens: short-lived JWT (HS256).
- Refresh tokens: JWT signed with a separate secret; a hash is stored server-side
  so tokens can be revoked and rotated.
- Face embeddings: Fernet symmetric encryption at rest.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.fernet import Fernet

from app.core.config import settings

# --------------------------------------------------------------------------- #
# Password hashing (Argon2id)
# --------------------------------------------------------------------------- #
_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,
    parallelism=2,
    hash_len=32,
    salt_len=16,
    type=Type.ID,  # Argon2id
)


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError, Exception):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    try:
        return _password_hasher.check_needs_rehash(password_hash)
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# OTP generation + hashing
# --------------------------------------------------------------------------- #
def generate_numeric_otp(length: Optional[int] = None) -> str:
    """Cryptographically secure numeric OTP (uses `secrets`, not `random`)."""
    n = length or settings.OTP_LENGTH
    upper = 10 ** n
    value = secrets.randbelow(upper)
    return str(value).zfill(n)


def hash_otp(otp: str) -> str:
    return hmac.new(
        settings.OTP_PEPPER.encode(), otp.encode(), hashlib.sha256
    ).hexdigest()


def verify_otp(otp: str, otp_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(otp), otp_hash)


# --------------------------------------------------------------------------- #
# Opaque tokens (session handles, refresh token storage)
# --------------------------------------------------------------------------- #
def generate_session_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """SHA-256 of a token, for storing refresh-token fingerprints server-side."""
    return hashlib.sha256(token.encode()).hexdigest()


# --------------------------------------------------------------------------- #
# JWT
# --------------------------------------------------------------------------- #
def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(subject: str, extra: Optional[dict[str, Any]] = None) -> str:
    now = _now()
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": uuid.uuid4().hex,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_scoped_token(subject: str, scope: str, minutes: Optional[int] = None) -> str:
    """Limited-purpose token, e.g. permitting face enrollment right after signup."""
    now = _now()
    payload = {
        "sub": str(subject),
        "type": "scoped",
        "scope": scope,
        "iat": now,
        "exp": now + timedelta(minutes=minutes or settings.ENROLL_TOKEN_EXPIRE_MINUTES),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> tuple[str, str, datetime]:
    """Return (token, jti, expires_at). Store hash_token(token) + jti server-side."""
    now = _now()
    jti = uuid.uuid4().hex
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(subject),
        "type": "refresh",
        "iat": now,
        "exp": expires_at,
        "jti": jti,
    }
    token = jwt.encode(
        payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return token, jti, expires_at


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def decode_refresh_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )


# --------------------------------------------------------------------------- #
# Face embedding encryption at rest (Fernet)
# --------------------------------------------------------------------------- #
_fernet = Fernet(settings.fernet_key)


def encrypt_bytes(data: bytes) -> bytes:
    return _fernet.encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    return _fernet.decrypt(token)
