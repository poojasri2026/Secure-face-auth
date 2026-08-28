"""Shared enumerations and a helper to store them as portable VARCHARs."""
from __future__ import annotations

import enum

from sqlalchemy import Enum as SAEnum


def enum_column(py_enum: type[enum.Enum], length: int = 40) -> SAEnum:
    """SQLAlchemy Enum stored as the enum *value* (portable across PG/SQLite)."""
    return SAEnum(
        py_enum,
        native_enum=False,
        length=length,
        values_callable=lambda e: [member.value for member in e],
        validate_strings=True,
    )


class OTPPurpose(str, enum.Enum):
    registration = "registration"
    login = "login"
    password_reset = "password_reset"
    email_change = "email_change"


class AuthMethod(str, enum.Enum):
    PASSWORD = "PASSWORD"
    EMAIL_OTP = "EMAIL_OTP"
    FACE = "FACE"
    LIVENESS = "LIVENESS"
    MFA = "MFA"


class AuthStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


class MfaState(str, enum.Enum):
    PASSWORD_PENDING = "PASSWORD_PENDING"
    PASSWORD_VERIFIED = "PASSWORD_VERIFIED"
    OTP_PENDING = "OTP_PENDING"
    OTP_VERIFIED = "OTP_VERIFIED"
    LIVENESS_PENDING = "LIVENESS_PENDING"
    LIVENESS_VERIFIED = "LIVENESS_VERIFIED"
    FACE_PENDING = "FACE_PENDING"
    FACE_VERIFIED = "FACE_VERIFIED"
    MFA_COMPLETE = "MFA_COMPLETE"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class LivenessStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class ChallengeType(str, enum.Enum):
    BLINK = "blink"
    TURN_LEFT = "turn_left"
    TURN_RIGHT = "turn_right"
    TILT_HEAD = "tilt_head"
    LOOK_UP = "look_up"
    LOOK_DOWN = "look_down"
