"""Authentication dependencies.

The frontend is never trusted: every protected route decodes and validates the
JWT here, loads the user from the database, and re-checks account state. A
scoped "enroll" token is accepted only by the face-enrollment route.
"""
from __future__ import annotations

import uuid
from typing import Optional

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.models.user import User
from app.services import auth_service

_bearer = HTTPBearer(auto_error=False)


def _extract_token(credentials: Optional[HTTPAuthorizationCredentials]) -> str:
    if credentials is None or not credentials.credentials:
        raise AppError("Not authenticated.", status_code=401, error_code="NOT_AUTHENTICATED")
    return credentials.credentials


def _decode(token: str) -> dict:
    try:
        return decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise AppError("Access token expired.", status_code=401, error_code="TOKEN_EXPIRED")
    except jwt.PyJWTError:
        raise AppError("Invalid access token.", status_code=401, error_code="TOKEN_INVALID")


async def _load_active_user(db: AsyncSession, sub: str) -> User:
    try:
        user_id = uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise AppError("Invalid token subject.", status_code=401, error_code="TOKEN_INVALID")
    user = await auth_service.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise AppError("Account unavailable.", status_code=401, error_code="ACCOUNT_UNAVAILABLE")
    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = _decode(_extract_token(credentials))
    if payload.get("type") != "access":
        raise AppError("Invalid token type.", status_code=401, error_code="TOKEN_INVALID")
    return await _load_active_user(db, payload.get("sub"))


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise AppError("Administrator access required.", status_code=403, error_code="FORBIDDEN")
    return user


async def get_enroll_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Accept either a full access token (re-enrollment while logged in) or a
    short-lived 'enroll'-scoped token issued right after email verification."""
    payload = _decode(_extract_token(credentials))
    ttype = payload.get("type")
    if ttype == "access":
        return await _load_active_user(db, payload.get("sub"))
    if ttype == "scoped" and payload.get("scope") == "enroll":
        user = await _load_active_user(db, payload.get("sub"))
        if not user.is_email_verified:
            raise AppError("Email not verified.", status_code=403, error_code="EMAIL_NOT_VERIFIED")
        return user
    raise AppError("Invalid or missing enrollment token.", status_code=401, error_code="TOKEN_INVALID")
