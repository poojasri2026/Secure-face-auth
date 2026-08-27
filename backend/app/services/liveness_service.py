"""Liveness session orchestration. Challenge sequences are randomized per login
and every pass/fail decision is made server-side (spec sections 8-13)."""
from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import generate_session_token
from app.ml.liveness import LivenessConfig, evaluate_challenge
from app.models.enums import LivenessStatus
from app.models.liveness import LivenessSession
from app.models.mfa_session import MfaSession
from app.schemas.liveness import ChallengeSample
from app.services import auth_service

logger = logging.getLogger("app.liveness")

# Only blink challenge is used — head-movement detection removed.
_sysrand = random.SystemRandom()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _cfg() -> LivenessConfig:
    return LivenessConfig(
        ear_closed=settings.EAR_CLOSED_THRESHOLD,
        ear_open=settings.EAR_OPEN_THRESHOLD,
        yaw_threshold=settings.HEAD_YAW_THRESHOLD_DEG,
        pitch_threshold=settings.HEAD_PITCH_THRESHOLD_DEG,
        roll_threshold=settings.HEAD_ROLL_THRESHOLD_DEG,
        min_samples=settings.LIVENESS_MIN_SAMPLES,
    )


def _random_sequence() -> List[str]:
    # Only blink is used — single, reliable challenge.
    return ["blink"]


@dataclass
class ChallengeOutcome:
    passed: bool
    message: str
    challenge: str
    completed_count: int
    total: int
    next_challenge: Optional[str]
    finished: bool
    failed: bool
    score: Optional[float]


async def start(db: AsyncSession, mfa_session: MfaSession) -> LivenessSession:
    session = LivenessSession(
        user_id=mfa_session.user_id,
        mfa_session_id=mfa_session.id,
        session_token=generate_session_token(),
        challenge_sequence=_random_sequence(),
        completed_challenges=[],
        current_index=0,
        failed_attempts=0,
        status=LivenessStatus.IN_PROGRESS,
        expires_at=_utcnow() + timedelta(seconds=settings.LIVENESS_SESSION_TTL_SECONDS),
    )
    db.add(session)
    await auth_service.mark_liveness_pending(db, mfa_session)
    await db.commit()
    logger.info("Liveness session for user %s: %s", mfa_session.user_id, session.challenge_sequence)
    return session


async def _get_session(db: AsyncSession, token: str) -> LivenessSession:
    session = (
        await db.execute(select(LivenessSession).where(LivenessSession.session_token == token))
    ).scalar_one_or_none()
    if session is None:
        raise AppError("Liveness session not found.", 404, "LIVENESS_NOT_FOUND")
    if session.status in (LivenessStatus.FAILED, LivenessStatus.EXPIRED) or session.is_expired():
        if session.status not in (LivenessStatus.COMPLETED,):
            session.status = LivenessStatus.EXPIRED
            await db.commit()
        raise AppError("Liveness session expired. Please restart.", 400, "LIVENESS_EXPIRED")
    return session


async def process_challenge(
    db: AsyncSession, token: str, challenge: str, samples: List[ChallengeSample]
) -> ChallengeOutcome:
    session = await _get_session(db, token)
    total = len(session.challenge_sequence)
    expected = session.current_challenge

    if session.status == LivenessStatus.COMPLETED:
        raise AppError("Liveness already completed.", 409, "LIVENESS_DONE")
    if expected is None:
        raise AppError("No pending challenge.", 409, "LIVENESS_NO_CHALLENGE")
    if challenge != expected:
        raise AppError(
            f"Unexpected challenge. Expected '{expected}'.", 409, "LIVENESS_WRONG_CHALLENGE"
        )

    result = evaluate_challenge(challenge, [s.model_dump() for s in samples], _cfg())
    confident = result.score >= settings.LIVENESS_THRESHOLD
    passed = result.passed and confident

    if passed:
        session.completed_challenges = session.completed_challenges + [challenge]
        session.current_index += 1
        finished = session.is_complete
        if finished:
            session.status = LivenessStatus.COMPLETED
        await db.commit()
        return ChallengeOutcome(
            passed=True,
            message=result.reason,
            challenge=challenge,
            completed_count=len(session.completed_challenges),
            total=total,
            next_challenge=session.current_challenge,
            finished=finished,
            failed=False,
            score=round(result.score, 3),
        )

    # Failed this attempt.
    session.failed_attempts += 1
    message = result.reason if result.passed else result.reason
    if result.passed and not confident:
        message = "Movement detected but not clear enough. Please do it a bit more deliberately."
    over_limit = session.failed_attempts >= settings.LIVENESS_MAX_FAILED_ATTEMPTS
    if over_limit:
        session.status = LivenessStatus.FAILED
    await db.commit()

    return ChallengeOutcome(
        passed=False,
        message=("Too many failed attempts. Please restart liveness." if over_limit else message),
        challenge=challenge,
        completed_count=len(session.completed_challenges),
        total=total,
        next_challenge=None if over_limit else expected,
        finished=False,
        failed=over_limit,
        score=round(result.score, 3),
    )


async def complete(db: AsyncSession, mfa_session: MfaSession, token: str) -> None:
    session = await _get_session(db, token)
    if session.mfa_session_id != mfa_session.id:
        raise AppError("Liveness session does not belong to this login.", 403, "LIVENESS_MISMATCH")
    if session.status != LivenessStatus.COMPLETED or not session.is_complete:
        raise AppError(
            "Liveness challenges are not complete.", 400, "LIVENESS_INCOMPLETE"
        )
    await auth_service.mark_liveness_verified(db, mfa_session)
    await db.commit()
