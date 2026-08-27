"""Admin-only monitoring and user-management routes.

Guarded by get_current_admin. Never returns secrets (password/OTP/embedding).
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import AppError
from app.middleware.auth import get_current_admin
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardResponse,
    AdminLogsResponse,
    AdminUserOut,
    AdminUsersResponse,
)
from app.services import admin_service, auth_service

logger = logging.getLogger("app.routes.admin")
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def dashboard(
    db: AsyncSession = Depends(get_db), _admin: User = Depends(get_current_admin)
):
    return await admin_service.dashboard(db)


@router.get("/users", response_model=AdminUsersResponse)
async def users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    return await admin_service.list_users(db, page, page_size, q)


@router.get("/logs", response_model=AdminLogsResponse)
async def logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    return await admin_service.list_logs(db, page, page_size, status, q)


@router.post("/users/{user_id}/set-active", response_model=AdminUserOut)
async def set_active(
    user_id: str,
    active: bool = Query(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise AppError("Invalid user id.", 400, "INVALID_USER_ID")
    if uid == admin.id and not active:
        raise AppError("You cannot deactivate your own account.", 400, "SELF_DEACTIVATE")

    user = await admin_service.set_user_active(db, uid, active)
    if user is None:
        raise AppError("User not found.", 404, "USER_NOT_FOUND")
    if not active:
        # Revoke all sessions of a deactivated user.
        await auth_service.revoke_all_for_user(db, uid)
        await db.commit()
    item = AdminUserOut.model_validate(user)
    item.mfa_enabled = bool(user.is_email_verified and user.is_face_enrolled)
    return item
