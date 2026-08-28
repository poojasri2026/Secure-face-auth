from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.core.database import Base
from app.models.enums import AuthMethod, AuthStatus, enum_column


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuthenticationLog(Base):
    __tablename__ = "authentication_logs"
    __table_args__ = (
        Index("ix_auth_logs_user_created", "user_id", "created_at"),
        Index("ix_auth_logs_status_created", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True, index=True)
    authentication_method: Mapped[AuthMethod] = mapped_column(
        enum_column(AuthMethod), nullable=False
    )
    status: Mapped[AuthStatus] = mapped_column(enum_column(AuthStatus), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )
