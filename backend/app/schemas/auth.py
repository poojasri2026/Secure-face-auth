from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.enums import OTPPurpose

# A tiny blocklist of extremely common passwords. Production should use a
# larger list (e.g. the "Have I Been Pwned" k-anonymity API or a wordlist file).
COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789", "qwerty123",
    "111111", "12345678910", "letmein", "iloveyou", "admin123", "welcome1",
    "abc12345", "changeme", "passw0rd", "qwertyuiop", "1q2w3e4r", "secret123",
}

_SPECIAL = re.compile(r"[^A-Za-z0-9]")


def validate_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if len(password) > 128:
        raise ValueError("Password must be at most 128 characters long")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain a lowercase letter")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain an uppercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain a digit")
    if not _SPECIAL.search(password):
        raise ValueError("Password must contain a special character")
    if password.lower() in COMMON_PASSWORDS:
        raise ValueError("This password is too common; choose a stronger one")
    return password


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name is required")
        return v

    @field_validator("password")
    @classmethod
    def _strong(cls, v: str) -> str:
        return validate_password_strength(v)

    @model_validator(mode="after")
    def _passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if self.email and self.email.split("@")[0].lower() in self.password.lower():
            raise ValueError("Password must not contain your email name")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class SendOtpRequest(BaseModel):
    """Resend/generate an OTP. Provide either (email + purpose) or an mfa_token."""
    email: Optional[EmailStr] = None
    purpose: Optional[OTPPurpose] = None
    mfa_token: Optional[str] = None

    @model_validator(mode="after")
    def _one_mode(self) -> "SendOtpRequest":
        if bool(self.mfa_token) == bool(self.email):
            raise ValueError("Provide either mfa_token or email (not both)")
        if self.email and not self.purpose:
            self.purpose = OTPPurpose.registration
        return self


class VerifyOtpRequest(BaseModel):
    code: str = Field(min_length=4, max_length=10)
    email: Optional[EmailStr] = None
    purpose: Optional[OTPPurpose] = None
    mfa_token: Optional[str] = None

    @field_validator("code")
    @classmethod
    def _digits(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit():
            raise ValueError("OTP must be numeric")
        return v

    @model_validator(mode="after")
    def _one_mode(self) -> "VerifyOtpRequest":
        if bool(self.mfa_token) == bool(self.email):
            raise ValueError("Provide either mfa_token or email (not both)")
        if self.email and not self.purpose:
            self.purpose = OTPPurpose.registration
        return self


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    email: EmailStr
    is_admin: bool = False

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, v):
        return str(v) if v is not None else v


class TokenResponse(BaseModel):
    success: bool = True
    message: str = "Authenticated"
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserSummary


class MfaStepResponse(BaseModel):
    """Generic response for an intermediate MFA stage."""
    success: bool
    message: str
    mfa_token: Optional[str] = None
    enrollment_token: Optional[str] = None
    state: Optional[str] = None
    next_step: Optional[str] = None


class RegisterResponse(BaseModel):
    success: bool = True
    message: str
    email: EmailStr
    next_step: str = "verify_email"


class EmailVerifiedResponse(BaseModel):
    success: bool = True
    message: str = "Email verified successfully"
    # Short-lived, enrollment-scoped token so the user can enroll their face
    # immediately after verifying, before their first full login.
    enrollment_token: str
    next_step: str = "enroll_face"
