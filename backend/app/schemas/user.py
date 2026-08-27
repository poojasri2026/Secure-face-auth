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


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    email: EmailStr
    is_email_verified: bool
    is_face_enrolled: bool
    is_active: bool
    is_admin: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    _id_str = field_validator("id", mode="before")(_stringify_id)
    _utc_dt = field_validator("created_at", "last_login_at", mode="before")(_ensure_utc)


class SecurityStatusOut(BaseModel):
    email_verified: bool
    face_enrolled: bool
    liveness_protection: bool = True
    mfa_enabled: bool
    active_sessions: int
    last_login_at: Optional[datetime] = None

    _utc_dt = field_validator("last_login_at", mode="before")(_ensure_utc)


class LoginHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    authentication_method: str
    status: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: datetime

    _id_str = field_validator("id", mode="before")(_stringify_id)
    _utc_dt = field_validator("created_at", mode="before")(_ensure_utc)


class LoginHistoryResponse(BaseModel):
    success: bool = True
    items: List[LoginHistoryItem]
    total: int


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: str
