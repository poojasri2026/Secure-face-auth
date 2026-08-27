"""OTP lifecycle (spec sections 4, 28): secure generation, hashing, expiry,
attempt limiting, resend cooldown, single-use invalidation."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import generate_numeric_otp, hash_otp, verify_otp
from app.models.enums import OTPPurpose
from app.models.otp import OTPVerification
from app.models.user import User
from app.services import email_service

logger = logging.getLogger("app.otp")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _latest_otp(db: AsyncSession, user_id, purpose: OTPPurpose) -> OTPVerification | None:
    result = await db.execute(
        select(OTPVerification)
        .where(OTPVerification.user_id == user_id, OTPVerification.purpose == purpose)
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def seconds_until_resend_allowed(db: AsyncSession, user_id, purpose: OTPPurpose) -> int:
    latest = await _latest_otp(db, user_id, purpose)
    if latest is None:
        return 0
    elapsed = (_utcnow() - _aware(latest.created_at)).total_seconds()
    remaining = settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed
    return max(0, int(remaining + 0.999))


async def create_and_send(
    db: AsyncSession,
    user: User,
    purpose: OTPPurpose,
    *,
    enforce_cooldown: bool = True,
) -> None:
    """Generate a fresh OTP, invalidate previous ones, and email it.

    The OTP is never returned to the caller.
    """
    if enforce_cooldown:
        wait = await seconds_until_resend_allowed(db, user.id, purpose)
        if wait > 0:
            raise AppError(
                f"Please wait {wait} seconds before requesting another code.",
                status_code=429,
                error_code="OTP_COOLDOWN",
            )

    # Invalidate any outstanding OTPs for this purpose (single active code).
    await db.execute(
        update(OTPVerification)
        .where(
            OTPVerification.user_id == user.id,
            OTPVerification.purpose == purpose,
            OTPVerification.verified.is_(False),
            OTPVerification.invalidated.is_(False),
        )
        .values(invalidated=True)
    )

    otp = generate_numeric_otp(settings.OTP_LENGTH)
    record = OTPVerification(
        user_id=user.id,
        otp_hash=hash_otp(otp),
        purpose=purpose,
        expires_at=_utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        attempts=0,
        max_attempts=settings.OTP_MAX_ATTEMPTS,
        verified=False,
        invalidated=False,
    )
    db.add(record)
    await db.commit()

    # Send AFTER commit so we never email a code we failed to persist.
    await email_service.send_otp_email(user.email, otp, purpose.value)
    logger.info("Issued %s OTP for user %s", purpose.value, user.id)


async def verify(db: AsyncSession, user: User, code: str, purpose: OTPPurpose) -> None:
    """Validate an OTP. Raises AppError on any failure; returns None on success."""
    otp = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.user_id == user.id,
            OTPVerification.purpose == purpose,
            OTPVerification.verified.is_(False),
            OTPVerification.invalidated.is_(False),
        )
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    otp = otp.scalar_one_or_none()

    if otp is None:
        raise AppError(
            "No active verification code. Please request a new one.",
            status_code=400,
            error_code="OTP_NOT_FOUND",
        )
    if otp.is_expired():
        raise AppError(
            "Verification code has expired. Please request a new one.",
            status_code=400,
            error_code="OTP_EXPIRED",
        )
    if otp.attempts >= otp.max_attempts:
        raise AppError(
            "Too many incorrect attempts. Please request a new code.",
            status_code=429,
            error_code="OTP_MAX_ATTEMPTS",
        )

    if not verify_otp(code, otp.otp_hash):
        otp.attempts += 1
        await db.commit()  # persist the attempt even though we raise
        remaining = max(0, otp.max_attempts - otp.attempts)
        raise AppError(
            f"Invalid verification code. {remaining} attempt(s) remaining.",
            status_code=400,
            error_code="OTP_INVALID",
        )

    # Success: mark verified and invalidate any siblings.
    otp.verified = True
    await db.execute(
        update(OTPVerification)
        .where(
            OTPVerification.user_id == user.id,
            OTPVerification.purpose == purpose,
            OTPVerification.id != otp.id,
            OTPVerification.verified.is_(False),
        )
        .values(invalidated=True)
    )
    await db.flush()
