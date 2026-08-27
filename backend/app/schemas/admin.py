from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


def _stringify_id(v):
    return str(v) if v is not None else v


def _ensure_utc(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)
    return v


class AdminStats(BaseModel):
    total_users: int
    verified_users: int
    face_enrolled_users: int
    failed_logins: int
    successful_mfa: int
    blocked_attempts: int
    active_sessions: int


class DailyActivity(BaseModel):
    date: str
    success: int
    failed: int
    blocked: int


class AuthLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    authentication_method: str
    status: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: datetime

    _ids_str = field_validator("id", "user_id", mode="before")(_stringify_id)
    _utc_dt = field_validator("created_at", mode="before")(_ensure_utc)


class AdminDashboardResponse(BaseModel):
    success: bool = True
    stats: AdminStats
    login_activity: List[DailyActivity]
    mfa_success: int
    mfa_failed: int
    recent_events: List[AuthLogOut]


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    email: EmailStr
    is_active: bool
    is_email_verified: bool
    is_face_enrolled: bool
    is_admin: bool
    mfa_enabled: bool = False
    last_login_at: Optional[datetime] = None
    created_at: datetime

    _id_str = field_validator("id", mode="before")(_stringify_id)
    _utc_dt = field_validator("created_at", "last_login_at", mode="before")(_ensure_utc)


class AdminUsersResponse(BaseModel):
    success: bool = True
    items: List[AdminUserOut]
    total: int
    page: int
    page_size: int


class AdminLogsResponse(BaseModel):
    success: bool = True
    items: List[AuthLogOut]
    total: int
    page: int
    page_size: int
