from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base
from app.models.enums import OTPPurpose, enum_column


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    otp_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    purpose: Mapped[OTPPurpose] = mapped_column(enum_column(OTPPurpose), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Set when superseded by a newly generated OTP for the same purpose.
    invalidated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="otps")

    def is_expired(self, now: Optional[datetime] = None) -> bool:
        now = now or _utcnow()
        exp = self.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return now >= exp

    def is_usable(self, now: Optional[datetime] = None) -> bool:
        return (
            not self.verified
            and not self.invalidated
            and self.attempts < self.max_attempts
            and not self.is_expired(now)
        )
