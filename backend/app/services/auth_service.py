"""Core authentication logic: registration, password verification with
brute-force lockout, the server-side MFA state machine, and JWT issuance /
rotation / revocation."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    hash_token,
    password_needs_rehash,
    verify_password,
    generate_session_token,
)
from app.models.enums import AuthMethod, AuthStatus, MfaState, OTPPurpose
from app.models.mfa_session import MfaSession
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.services import logging_service, otp_service

logger = logging.getLogger("app.auth")

# Pre-computed hash used to equalize timing when an email does not exist.
_DUMMY_HASH = hash_password("timing-equalization-not-a-real-password-01!")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@dataclass
class PasswordAuthResult:
    user: Optional[User]
    ok: bool
    error_code: Optional[str] = None
    message: Optional[str] = None
    needs_email_verification: bool = False


# --------------------------------------------------------------------------- #
# Lookups
# --------------------------------------------------------------------------- #
async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


# --------------------------------------------------------------------------- #
# Registration
# --------------------------------------------------------------------------- #
async def register(db: AsyncSession, data: RegisterRequest, request=None) -> User:
    email = data.email.lower()
    existing = await get_user_by_email(db, email)

    if existing and existing.is_email_verified:
        raise AppError(
            "An account with this email already exists.",
            status_code=409,
            error_code="EMAIL_EXISTS",
        )

    if existing and not existing.is_email_verified:
        # Allow completing an abandoned, unverified signup.
        existing.full_name = data.full_name
        existing.password_hash = hash_password(data.password)
        await db.flush()
        await otp_service.create_and_send(
            db, existing, OTPPurpose.registration, enforce_cooldown=False
        )
        return existing

    user = User(
        full_name=data.full_name,
        email=email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.flush()
    await otp_service.create_and_send(
        db, user, OTPPurpose.registration, enforce_cooldown=False
    )
    logger.info("Registered user %s", email)
    return user


# --------------------------------------------------------------------------- #
# Password authentication (login stage 1)
# --------------------------------------------------------------------------- #
async def authenticate_password(
    db: AsyncSession, email: str, password: str, request=None
) -> PasswordAuthResult:
    email_l = email.lower()
    user = await get_user_by_email(db, email_l)
    now = _utcnow()

    # Same generic message regardless of which check fails (no user enumeration).
    generic = PasswordAuthResult(None, False, "AUTH_FAILED", "Invalid email or password")

    if user is None:
        verify_password(password, _DUMMY_HASH)  # constant-time-ish
        await logging_service.record(
            db, method=AuthMethod.PASSWORD, status=AuthStatus.FAILED,
            request=request, email=email_l, failure_reason="user_not_found", commit=True,
        )
        return generic

    locked_until = _aware(user.locked_until)
    if locked_until and locked_until > now:
        await logging_service.record(
            db, method=AuthMethod.PASSWORD, status=AuthStatus.BLOCKED,
            request=request, user=user, failure_reason="account_locked", commit=True,
        )
        return PasswordAuthResult(
            user, False, "ACCOUNT_LOCKED",
            "Account temporarily locked due to failed attempts. Try again later.",
        )

    if not user.is_active:
        await logging_service.record(
            db, method=AuthMethod.PASSWORD, status=AuthStatus.BLOCKED,
            request=request, user=user, failure_reason="account_disabled", commit=True,
        )
        return PasswordAuthResult(user, False, "ACCOUNT_DISABLED", "This account is disabled.")

    if not verify_password(password, user.password_hash):
        user.failed_login_count += 1
        status = AuthStatus.FAILED
        reason = "bad_password"
        if user.failed_login_count >= settings.LOGIN_MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
            user.failed_login_count = 0
            status = AuthStatus.BLOCKED
            reason = "locked_after_failures"
        await logging_service.record(
            db, method=AuthMethod.PASSWORD, status=status,
            request=request, user=user, failure_reason=reason, commit=True,
        )
        return generic

    # Success.
    user.failed_login_count = 0
    user.locked_until = None
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    await logging_service.record(
        db, method=AuthMethod.PASSWORD, status=AuthStatus.SUCCESS, request=request, user=user,
    )
    return PasswordAuthResult(
        user, True, needs_email_verification=not user.is_email_verified
    )


# --------------------------------------------------------------------------- #
# MFA session state machine
# --------------------------------------------------------------------------- #
async def create_mfa_session(db: AsyncSession, user: User, request=None) -> MfaSession:
    session = MfaSession(
        user_id=user.id,
        session_token=generate_session_token(),
        state=MfaState.PASSWORD_VERIFIED,
        password_verified_at=_utcnow(),
        ip_address=logging_service.client_ip(request),
        user_agent=logging_service.user_agent(request),
        expires_at=_utcnow() + timedelta(seconds=settings.MFA_SESSION_TTL_SECONDS),
    )
    db.add(session)
    await db.flush()
    return session


async def get_mfa_session(
    db: AsyncSession,
    token: str,
    *,
    expected_states: Optional[Iterable[MfaState]] = None,
    load_user: bool = True,
) -> MfaSession:
    stmt = select(MfaSession).where(MfaSession.session_token == token)
    if load_user:
        stmt = stmt.options(selectinload(MfaSession.user))
    session = (await db.execute(stmt)).scalar_one_or_none()

    if session is None:
        raise AppError("Invalid login session.", status_code=401, error_code="MFA_SESSION_INVALID")

    if session.state in (MfaState.FAILED, MfaState.EXPIRED) or session.is_expired():
        session.state = MfaState.EXPIRED
        await db.commit()
        raise AppError(
            "Your login session has expired. Please start again.",
            status_code=401, error_code="MFA_SESSION_EXPIRED",
        )

    if expected_states is not None and session.state not in set(expected_states):
        raise AppError(
            "Unexpected authentication step for this session.",
            status_code=409, error_code="MFA_STATE_INVALID",
        )
    return session


async def mark_otp_verified(db: AsyncSession, session: MfaSession) -> None:
    session.state = MfaState.OTP_VERIFIED
    session.otp_verified_at = _utcnow()
    await db.flush()


async def mark_liveness_pending(db: AsyncSession, session: MfaSession) -> None:
    session.state = MfaState.LIVENESS_PENDING
    await db.flush()


async def mark_liveness_verified(db: AsyncSession, session: MfaSession) -> None:
    session.state = MfaState.LIVENESS_VERIFIED
    session.liveness_verified_at = _utcnow()
    await db.flush()


async def fail_session(db: AsyncSession, session: MfaSession) -> None:
    session.state = MfaState.FAILED
    await db.commit()


# --------------------------------------------------------------------------- #
# Token issuance / rotation / revocation
# --------------------------------------------------------------------------- #
async def issue_tokens(db: AsyncSession, user: User, request=None) -> tuple[str, str, int]:
    access = create_access_token(str(user.id), {"is_admin": user.is_admin})
    refresh_raw, jti, expires_at = create_refresh_token(str(user.id))
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_raw),
            jti=jti,
            expires_at=expires_at,
            user_agent=logging_service.user_agent(request),
            ip_address=logging_service.client_ip(request),
        )
    )
    await db.flush()
    return access, refresh_raw, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


async def complete_mfa(
    db: AsyncSession, session: MfaSession, user: User, request=None
) -> tuple[str, str, int]:
    session.state = MfaState.FACE_VERIFIED
    session.face_verified_at = _utcnow()
    session.state = MfaState.MFA_COMPLETE
    user.last_login_at = _utcnow()

    access, refresh_raw, expires_in = await issue_tokens(db, user, request)
    await logging_service.record(
        db, method=AuthMethod.MFA, status=AuthStatus.SUCCESS, request=request, user=user,
    )
    await db.commit()
    return access, refresh_raw, expires_in


async def rotate_refresh_token(
    db: AsyncSession, raw_token: str, request=None
) -> tuple[str, str, int]:
    try:
        payload = decode_refresh_token(raw_token)
    except Exception:
        raise AppError("Invalid refresh token.", status_code=401, error_code="INVALID_REFRESH")
    if payload.get("type") != "refresh":
        raise AppError("Invalid refresh token.", status_code=401, error_code="INVALID_REFRESH")

    token_hash = hash_token(raw_token)
    stored = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    ).scalar_one_or_none()

    if stored is None:
        raise AppError("Session not found. Please log in again.", 401, "REFRESH_NOT_FOUND")
    if stored.revoked:
        # Re-use of an already-rotated token: revoke the whole family defensively.
        await revoke_all_for_user(db, stored.user_id)
        await db.commit()
        raise AppError("Session reuse detected. Please log in again.", 401, "REFRESH_REUSED")
    if _aware(stored.expires_at) <= _utcnow():
        raise AppError("Session expired. Please log in again.", 401, "REFRESH_EXPIRED")

    user = await get_user_by_id(db, stored.user_id)
    if user is None or not user.is_active:
        raise AppError("Account unavailable.", 401, "ACCOUNT_UNAVAILABLE")

    stored.revoked = True  # rotation
    access, new_refresh, expires_in = await issue_tokens(db, user, request)
    await db.commit()
    return access, new_refresh, expires_in


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    token_hash = hash_token(raw_token)
    await db.execute(
        update(RefreshToken).where(RefreshToken.token_hash == token_hash).values(revoked=True)
    )
    await db.commit()


async def revoke_all_for_user(db: AsyncSession, user_id) -> int:
    result = await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    return result.rowcount or 0


async def count_active_sessions(db: AsyncSession, user_id) -> int:
    from sqlalchemy import func

    result = await db.execute(
        select(func.count())
        .select_from(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > _utcnow(),
        )
    )
    return int(result.scalar() or 0)
