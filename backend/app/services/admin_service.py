"""Read-only aggregation queries for the admin dashboard.

Deliberately never selects password hashes, OTP hashes, or face embeddings.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_log import AuthenticationLog
from app.models.enums import AuthMethod, AuthStatus
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardResponse,
    AdminLogsResponse,
    AdminStats,
    AdminUserOut,
    AdminUsersResponse,
    AuthLogOut,
    DailyActivity,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _count(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar() or 0)


async def dashboard(db: AsyncSession) -> AdminDashboardResponse:
    now = _utcnow()
    total_users = await _count(db, select(func.count()).select_from(User))
    verified_users = await _count(
        db, select(func.count()).select_from(User).where(User.is_email_verified.is_(True))
    )
    face_users = await _count(
        db, select(func.count()).select_from(User).where(User.is_face_enrolled.is_(True))
    )
    failed_logins = await _count(
        db,
        select(func.count()).select_from(AuthenticationLog).where(
            AuthenticationLog.status == AuthStatus.FAILED
        ),
    )
    blocked = await _count(
        db,
        select(func.count()).select_from(AuthenticationLog).where(
            AuthenticationLog.status == AuthStatus.BLOCKED
        ),
    )
    mfa_success = await _count(
        db,
        select(func.count()).select_from(AuthenticationLog).where(
            AuthenticationLog.authentication_method == AuthMethod.MFA,
            AuthenticationLog.status == AuthStatus.SUCCESS,
        ),
    )
    mfa_failed = await _count(
        db,
        select(func.count()).select_from(AuthenticationLog).where(
            AuthenticationLog.authentication_method == AuthMethod.MFA,
            AuthenticationLog.status == AuthStatus.FAILED,
        ),
    )
    active_sessions = await _count(
        db,
        select(func.count()).select_from(RefreshToken).where(
            RefreshToken.revoked.is_(False), RefreshToken.expires_at > now
        ),
    )

    # Daily activity for the last 7 days (bucketed in Python for DB portability).
    since = now - timedelta(days=6)
    since_midnight = since.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = (
        await db.execute(
            select(AuthenticationLog.status, AuthenticationLog.created_at).where(
                AuthenticationLog.created_at >= since_midnight
            )
        )
    ).all()

    buckets: dict[str, dict[str, int]] = {}
    for i in range(7):
        d = (since_midnight + timedelta(days=i)).date().isoformat()
        buckets[d] = {"success": 0, "failed": 0, "blocked": 0}
    for status, created_at in rows:
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        d = created_at.date().isoformat()
        if d not in buckets:
            continue
        if status == AuthStatus.SUCCESS:
            buckets[d]["success"] += 1
        elif status == AuthStatus.FAILED:
            buckets[d]["failed"] += 1
        elif status == AuthStatus.BLOCKED:
            buckets[d]["blocked"] += 1
    login_activity = [
        DailyActivity(date=d, success=v["success"], failed=v["failed"], blocked=v["blocked"])
        for d, v in sorted(buckets.items())
    ]

    recent_rows = (
        await db.execute(
            select(AuthenticationLog).order_by(AuthenticationLog.created_at.desc()).limit(20)
        )
    ).scalars().all()
    recent_events = [AuthLogOut.model_validate(r) for r in recent_rows]

    stats = AdminStats(
        total_users=total_users,
        verified_users=verified_users,
        face_enrolled_users=face_users,
        failed_logins=failed_logins,
        successful_mfa=mfa_success,
        blocked_attempts=blocked,
        active_sessions=active_sessions,
    )
    return AdminDashboardResponse(
        stats=stats,
        login_activity=login_activity,
        mfa_success=mfa_success,
        mfa_failed=mfa_failed,
        recent_events=recent_events,
    )


async def list_users(
    db: AsyncSession, page: int, page_size: int, q: Optional[str] = None
) -> AdminUsersResponse:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    base = select(User)
    count_stmt = select(func.count()).select_from(User)
    if q:
        like = f"%{q.lower()}%"
        cond = or_(func.lower(User.email).like(like), func.lower(User.full_name).like(like))
        base = base.where(cond)
        count_stmt = count_stmt.where(cond)
    total = await _count(db, count_stmt)
    rows = (
        await db.execute(
            base.order_by(User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    items: List[AdminUserOut] = []
    for u in rows:
        item = AdminUserOut.model_validate(u)
        item.mfa_enabled = bool(u.is_email_verified and u.is_face_enrolled)
        items.append(item)
    return AdminUsersResponse(items=items, total=total, page=page, page_size=page_size)


async def list_logs(
    db: AsyncSession,
    page: int,
    page_size: int,
    status: Optional[str] = None,
    q: Optional[str] = None,
) -> AdminLogsResponse:
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    base = select(AuthenticationLog)
    count_stmt = select(func.count()).select_from(AuthenticationLog)
    if status:
        base = base.where(AuthenticationLog.status == status)
        count_stmt = count_stmt.where(AuthenticationLog.status == status)
    if q:
        like = f"%{q.lower()}%"
        cond = func.lower(AuthenticationLog.email).like(like)
        base = base.where(cond)
        count_stmt = count_stmt.where(cond)
    total = await _count(db, count_stmt)
    rows = (
        await db.execute(
            base.order_by(AuthenticationLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    items = [AuthLogOut.model_validate(r) for r in rows]
    return AdminLogsResponse(items=items, total=total, page=page, page_size=page_size)


async def set_user_active(db: AsyncSession, user_id, active: bool) -> Optional[User]:
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        return None
    user.is_active = active
    await db.commit()
    return user
