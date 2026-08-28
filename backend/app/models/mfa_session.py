from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base
from app.models.enums import MfaState, enum_column


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MfaSession(Base):
    """Server-side login/MFA state machine.

    The client only ever holds the opaque `session_token`. Every stage
    transition is validated and written here, so the frontend cannot skip a
    step by mutating local state.
    """

    __tablename__ = "mfa_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    session_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    state: Mapped[MfaState] = mapped_column(
        enum_column(MfaState), default=MfaState.PASSWORD_VERIFIED, nullable=False
    )
    password_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    otp_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    liveness_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    face_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="mfa_sessions")
    liveness_sessions: Mapped[List["LivenessSession"]] = relationship(
        back_populates="mfa_session", cascade="all, delete-orphan"
    )

    def is_expired(self, now: Optional[datetime] = None) -> bool:
        now = now or _utcnow()
        exp = self.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return now >= exp
