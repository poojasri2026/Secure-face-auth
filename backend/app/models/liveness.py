from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base
from app.models.enums import LivenessStatus, enum_column


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LivenessSession(Base):
    __tablename__ = "liveness_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    mfa_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("mfa_sessions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    session_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    challenge_sequence: Mapped[List[str]] = mapped_column(
        MutableList.as_mutable(JSON), default=list, nullable=False
    )
    completed_challenges: Mapped[List[str]] = mapped_column(
        MutableList.as_mutable(JSON), default=list, nullable=False
    )
    current_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[LivenessStatus] = mapped_column(
        enum_column(LivenessStatus), default=LivenessStatus.PENDING, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="liveness_sessions")
    mfa_session: Mapped[Optional["MfaSession"]] = relationship(
        back_populates="liveness_sessions"
    )

    def is_expired(self, now: Optional[datetime] = None) -> bool:
        now = now or _utcnow()
        exp = self.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return now >= exp

    @property
    def current_challenge(self) -> Optional[str]:
        if 0 <= self.current_index < len(self.challenge_sequence):
            return self.challenge_sequence[self.current_index]
        return None

    @property
    def is_complete(self) -> bool:
        return len(self.completed_challenges) >= len(self.challenge_sequence)
