"""Face enrollment and the face-match MFA step. The backend owns the match
decision; the client never receives the similarity score or the embedding."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.cookies import set_refresh_cookie
from app.core.database import get_db
from app.core.errors import AppError
from app.middleware.auth import get_current_user, get_enroll_user
from app.models.enums import AuthMethod, AuthStatus, MfaState
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.face import (
    FaceEnrollRequest,
    FaceEnrollResponse,
    FaceVerifyRequest,
    FaceVerifyResponse,
)
from app.services import auth_service, face_service, logging_service

logger = logging.getLogger("app.routes.face")
router = APIRouter(prefix="/face", tags=["face"])


@router.post("/enroll", response_model=FaceEnrollResponse)
async def enroll(
    data: FaceEnrollRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_enroll_user),
):
    accepted = await face_service.enroll(db, user, data.images)
    return FaceEnrollResponse(
        success=True,
        message="Face enrolled successfully. You can now log in.",
        samples_accepted=accepted,
        is_face_enrolled=True,
    )


@router.post("/verify", response_model=FaceVerifyResponse)
async def verify(
    data: FaceVerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    session = await auth_service.get_mfa_session(
        db, data.mfa_token, expected_states=[MfaState.LIVENESS_VERIFIED],
    )
    user = session.user
    outcome = await face_service.verify(db, user, data.image)

    if not outcome.matched:
        await logging_service.record(
            db, method=AuthMethod.FACE, status=AuthStatus.FAILED,
            request=request, user=user, failure_reason="face_mismatch", commit=True,
        )
        raise AppError(
            "Face did not match the enrolled profile.", 401, "FACE_MISMATCH"
        )

    await logging_service.record(
        db, method=AuthMethod.FACE, status=AuthStatus.SUCCESS, request=request, user=user,
    )
    access, refresh_raw, expires_in = await auth_service.complete_mfa(db, session, user, request)
    set_refresh_cookie(response, refresh_raw)
    return FaceVerifyResponse(
        success=True,
        message="Authentication complete.",
        access_token=access,
        token_type="bearer",
        expires_in=expires_in,
        state=MfaState.MFA_COMPLETE.value,
    )


@router.delete("", response_model=SuccessResponse)
async def delete_face(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await face_service.delete_enrollment(db, user)
    return SuccessResponse(message="Face data deleted.")
