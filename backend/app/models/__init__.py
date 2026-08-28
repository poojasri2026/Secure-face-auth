"""Import all models so they register on Base.metadata."""
from app.models.auth_log import AuthenticationLog
from app.models.enums import (
    AuthMethod,
    AuthStatus,
    ChallengeType,
    LivenessStatus,
    MfaState,
    OTPPurpose,
)
from app.models.liveness import LivenessSession
from app.models.mfa_session import MfaSession
from app.models.otp import OTPVerification
from app.models.refresh_token import RefreshToken
from app.models.user import User

__all__ = [
    "User",
    "OTPVerification",
    "AuthenticationLog",
    "RefreshToken",
    "LivenessSession",
    "MfaSession",
    "AuthMethod",
    "AuthStatus",
    "ChallengeType",
    "LivenessStatus",
    "MfaState",
    "OTPPurpose",
]
