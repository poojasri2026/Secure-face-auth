"""Authentication routes.

Flow (server-authoritative — see spec section 24):
  register -> verify-email -> (enroll face with enrollment_token) -> login
  login -> verify-otp -> liveness/start..complete -> face/verify -> tokens

Every decision is made here on the server. The client only ever carries opaque
session tokens and a short-lived access token.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.cookies import clear_refresh_cookie, set_refresh_cookie
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import create_scoped_token, decode_access_token
from app.models.enums import AuthMethod, AuthStatus, MfaState, OTPPurpose
from app.core.database import get_db
from app.schemas.auth import (
    EmailVerifiedResponse,
    LoginRequest,
    MfaStepResponse,
    RegisterRequest,
    RegisterResponse,
    SendOtpRequest,
    TokenResponse,
    UserSummary,
    VerifyOtpRequest,
)
from app.schemas.common import SuccessResponse
from app.services import auth_service, logging_service, otp_service

logger = logging.getLogger("app.routes.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(data: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await auth_service.register(db, data, request)
    return RegisterResponse(
        message="Registration received. Check your email for a verification code.",
        email=user.email,
    )


@router.post("/verify-email", response_model=EmailVerifiedResponse)
async def verify_email(data: VerifyOtpRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if not data.email:
        raise AppError("Email is required to verify.", 400, "EMAIL_REQUIRED")
    user = await auth_service.get_user_by_email(db, data.email)
    if user is None:
        # Do not reveal which emails are registered.
        raise AppError("Invalid or expired verification code.", 400, "OTP_INVALID")

    await otp_service.verify(db, user, data.code, OTPPurpose.registration)
    user.is_email_verified = True
    await logging_service.record(
        db, method=AuthMethod.EMAIL_OTP, status=AuthStatus.SUCCESS, request=request, user=user,
    )
    await db.commit()

    enrollment_token = create_scoped_token(str(user.id), scope="enroll")
    return EmailVerifiedResponse(enrollment_token=enrollment_token)


@router.post("/resend-otp", response_model=SuccessResponse)
async def resend_otp(data: SendOtpRequest, request: Request, db: AsyncSession = Depends(get_db)):
    generic = SuccessResponse(message="If the account exists, a new code has been sent.")
    if data.mfa_token:
        session = await auth_service.get_mfa_session(
            db, data.mfa_token,
            expected_states=[MfaState.PASSWORD_VERIFIED, MfaState.OTP_PENDING],
        )
        try:
            await otp_service.create_and_send(db, session.user, OTPPurpose.login)
        except AppError as exc:
            if exc.error_code == "OTP_COOLDOWN":
                raise
        return SuccessResponse(message="A new code has been sent.")

    # Email mode (registration). Always return a generic message.
    user = await auth_service.get_user_by_email(db, data.email) if data.email else None
    if user is not None and not user.is_email_verified:
        try:
            await otp_service.create_and_send(db, user, OTPPurpose.registration)
        except AppError:
            pass
    return generic


@router.post("/login", response_model=MfaStepResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await auth_service.authenticate_password(db, data.email, data.password, request)
    if not result.ok:
        raise AppError(result.message or "Invalid email or password", 401, result.error_code)

    user = result.user
    if result.needs_email_verification:
        raise AppError(
            "Please verify your email before logging in.", 403, "EMAIL_NOT_VERIFIED"
        )

    if not user.is_face_enrolled:
        # First-time (or abandoned) enrollment: hand back a scoped enroll token.
        enrollment_token = create_scoped_token(str(user.id), scope="enroll")
        return MfaStepResponse(
            success=True,
            message="Face enrollment is required to finish setting up your account.",
            enrollment_token=enrollment_token,
            state="ENROLL_REQUIRED",
            next_step="enroll_face",
        )

    # Full MFA: start a server-side session and send the email OTP.
    session = await auth_service.create_mfa_session(db, user, request)
    await otp_service.create_and_send(db, user, OTPPurpose.login, enforce_cooldown=False)
    return MfaStepResponse(
        success=True,
        message="Password verified. Enter the verification code sent to your email.",
        mfa_token=session.session_token,
        state=session.state.value,
        next_step="verify_otp",
    )


@router.post("/verify-otp", response_model=MfaStepResponse)
async def verify_otp(data: VerifyOtpRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if not data.mfa_token:
        raise AppError("A login session token is required.", 400, "MFA_TOKEN_REQUIRED")

    session = await auth_service.get_mfa_session(
        db, data.mfa_token,
        expected_states=[MfaState.PASSWORD_VERIFIED, MfaState.OTP_PENDING],
    )
    user = session.user
    try:
        await otp_service.verify(db, user, data.code, OTPPurpose.login)
    except AppError:
        await logging_service.record(
            db, method=AuthMethod.EMAIL_OTP, status=AuthStatus.FAILED,
            request=request, user=user, failure_reason="otp_invalid", commit=True,
        )
        raise

    await auth_service.mark_otp_verified(db, session)
    await logging_service.record(
        db, method=AuthMethod.EMAIL_OTP, status=AuthStatus.SUCCESS, request=request, user=user,
    )
    await db.commit()
    return MfaStepResponse(
        success=True,
        message="Code verified. Continue with the liveness check.",
        mfa_token=session.session_token,
        state=session.state.value,
        next_step="liveness",
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not raw:
        raise AppError("No refresh token.", 401, "NO_REFRESH_TOKEN")
    access, new_refresh, expires_in = await auth_service.rotate_refresh_token(db, raw, request)
    set_refresh_cookie(response, new_refresh)

    payload = decode_access_token(access)
    user = await auth_service.get_user_by_id(db, uuid.UUID(payload["sub"]))
    return TokenResponse(
        message="Token refreshed",
        access_token=access,
        expires_in=expires_in,
        user=UserSummary.model_validate(user),
    )


@router.post("/logout", response_model=SuccessResponse)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if raw:
        await auth_service.revoke_refresh_token(db, raw)
    clear_refresh_cookie(response)
    return SuccessResponse(message="Logged out.")
