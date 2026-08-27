from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ChallengeSample(BaseModel):
    """One per-frame measurement computed in the browser from face landmarks.

    Only these small numeric signals are sent to the backend (not video frames).
    The backend decides whether the challenge was genuinely satisfied.
    """
    t: float = Field(description="client timestamp in milliseconds")
    ear: Optional[float] = Field(default=None, description="eye aspect ratio")
    yaw: Optional[float] = Field(default=None, description="head yaw in degrees")
    pitch: Optional[float] = Field(default=None, description="head pitch in degrees")
    roll: Optional[float] = Field(default=None, description="head roll in degrees")
    face_count: int = 1
    confidence: float = 1.0
    box_ratio: float = Field(default=0.0, description="face box area / frame area")


class LivenessStartRequest(BaseModel):
    mfa_token: str


class LivenessStartResponse(BaseModel):
    success: bool = True
    message: str = "Liveness session started"
    liveness_token: str
    challenges: List[str]
    total_challenges: int
    per_challenge_timeout_seconds: int
    expires_at: datetime


class LivenessChallengeRequest(BaseModel):
    liveness_token: str
    challenge: str
    samples: List[ChallengeSample] = Field(min_length=1, max_length=600)


class LivenessChallengeResponse(BaseModel):
    success: bool
    message: str
    challenge: str
    passed: bool
    completed_count: int
    total_challenges: int
    next_challenge: Optional[str] = None
    finished: bool = False
    score: Optional[float] = None


class LivenessCompleteRequest(BaseModel):
    mfa_token: str
    liveness_token: str


class LivenessCompleteResponse(BaseModel):
    success: bool
    message: str
    state: Optional[str] = None
    next_step: Optional[str] = None
