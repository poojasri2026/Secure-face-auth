"""Authenticated end-user account routes."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.middleware.auth import get_current_user
from app.models.auth_log import AuthenticationLog
from app.models.enums import AuthMethod, AuthStatus
from app.models.user import User
from app.schemas.auth import validate_password_strength
from app.schemas.common import SuccessResponse
from app.schemas.user import (
    ChangePasswordRequest,
    LoginHistoryItem,
    LoginHistoryResponse,
    SecurityStatusOut,
    UserOut,
)
from app.services import auth_service, logging_service

logger = logging.getLogger("app.routes.users")
router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.get("/security", response_model=SecurityStatusOut)
async def security_status(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    active = await auth_service.count_active_sessions(db, user.id)
    return SecurityStatusOut(
        email_verified=user.is_email_verified,
        face_enrolled=user.is_face_enrolled,
        liveness_protection=True,
        mfa_enabled=bool(user.is_email_verified and user.is_face_enrolled),
        active_sessions=active,
        last_login_at=user.last_login_at,
    )


@router.get("/login-history", response_model=LoginHistoryResponse)
async def login_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    total = int(
        (
            await db.execute(
                select(func.count())
                .select_from(AuthenticationLog)
                .where(AuthenticationLog.user_id == user.id)
            )
        ).scalar()
        or 0
    )
    rows = (
        await db.execute(
            select(AuthenticationLog)
            .where(AuthenticationLog.user_id == user.id)
            .order_by(AuthenticationLog.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    items = [LoginHistoryItem.model_validate(r) for r in rows]
    return LoginHistoryResponse(items=items, total=total)


@router.post("/change-password", response_model=SuccessResponse)
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, user.password_hash):
        await logging_service.record(
            db, method=AuthMethod.PASSWORD, status=AuthStatus.FAILED,
            request=request, user=user, failure_reason="change_password_bad_current", commit=True,
        )
        raise AppError("Current password is incorrect.", 400, "BAD_CURRENT_PASSWORD")
    if data.new_password != data.confirm_new_password:
        raise AppError("New passwords do not match.", 400, "PASSWORD_MISMATCH")
    try:
        validate_password_strength(data.new_password)
    except ValueError as exc:
        raise AppError(str(exc), 400, "WEAK_PASSWORD")
    if verify_password(data.new_password, user.password_hash):
        raise AppError("New password must be different.", 400, "PASSWORD_REUSED")

    user.password_hash = hash_password(data.new_password)
    # Invalidate every existing session; the user must log in again everywhere.
    await auth_service.revoke_all_for_user(db, user.id)
    await db.commit()
    return SuccessResponse(message="Password changed. Please log in again on other devices.")


@router.post("/logout-all", response_model=SuccessResponse)
async def logout_all(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    revoked = await auth_service.revoke_all_for_user(db, user.id)
    await db.commit()
    return SuccessResponse(message=f"Signed out of {revoked} session(s).")
