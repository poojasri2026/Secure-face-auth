from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class FaceEnrollRequest(BaseModel):
    """Several still frames captured during the guided enrollment sequence.

    Each image is a base64 data URL or raw base64 (JPEG/PNG). The full video
    stream is never uploaded.
    """
    images: List[str] = Field(min_length=1, max_length=15)


class FaceEnrollResponse(BaseModel):
    success: bool
    message: str
    samples_accepted: int = 0
    is_face_enrolled: bool = False


class FaceVerifyRequest(BaseModel):
    mfa_token: str
    image: str  # single still frame, base64


class FaceVerifyResponse(BaseModel):
    success: bool
    message: str
    # Only present on the final successful step of the whole MFA flow.
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    expires_in: Optional[int] = None
    state: Optional[str] = None
