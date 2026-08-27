"""Liveness challenge routes. Each pass/fail is decided server-side by
app.ml.liveness from the numeric signal samples the browser sends."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.enums import AuthMethod, AuthStatus, MfaState
from app.schemas.liveness import (
    LivenessChallengeRequest,
    LivenessChallengeResponse,
    LivenessCompleteRequest,
    LivenessCompleteResponse,
    LivenessStartRequest,
    LivenessStartResponse,
)
from app.core.config import settings
from app.services import auth_service, liveness_service, logging_service

logger = logging.getLogger("app.routes.liveness")
router = APIRouter(prefix="/liveness", tags=["liveness"])


@router.post("/start", response_model=LivenessStartResponse)
async def start(data: LivenessStartRequest, db: AsyncSession = Depends(get_db)):
    session = await auth_service.get_mfa_session(
        db, data.mfa_token,
        expected_states=[MfaState.OTP_VERIFIED, MfaState.LIVENESS_PENDING],
    )
    liveness = await liveness_service.start(db, session)
    return LivenessStartResponse(
        liveness_token=liveness.session_token,
        challenges=list(liveness.challenge_sequence),
        total_challenges=len(liveness.challenge_sequence),
        per_challenge_timeout_seconds=settings.LIVENESS_PER_CHALLENGE_TIMEOUT_SECONDS,
        expires_at=liveness.expires_at,
    )


@router.post("/challenge", response_model=LivenessChallengeResponse)
async def challenge(data: LivenessChallengeRequest, db: AsyncSession = Depends(get_db)):
    outcome = await liveness_service.process_challenge(
        db, data.liveness_token, data.challenge, data.samples
    )
    return LivenessChallengeResponse(
        success=True,
        message=outcome.message,
        challenge=outcome.challenge,
        passed=outcome.passed,
        completed_count=outcome.completed_count,
        total_challenges=outcome.total,
        next_challenge=outcome.next_challenge,
        finished=outcome.finished,
        score=outcome.score,
    )


@router.post("/complete", response_model=LivenessCompleteResponse)
async def complete(
    data: LivenessCompleteRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    session = await auth_service.get_mfa_session(
        db, data.mfa_token, expected_states=[MfaState.LIVENESS_PENDING],
    )
    await liveness_service.complete(db, session, data.liveness_token)
    await logging_service.record(
        db, method=AuthMethod.LIVENESS, status=AuthStatus.SUCCESS,
        request=request, user=session.user,
    )
    await db.commit()
    return LivenessCompleteResponse(
        success=True,
        message="Liveness verified. Continue with face verification.",
        state=session.state.value,
        next_step="face_verify",
    )
