"""Face enrollment and verification. The backend ALWAYS makes the match decision
(spec sections 7, 44). Embeddings are encrypted at rest and never leave the server."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Tuple

from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import decrypt_bytes, encrypt_bytes
from app.ml.face_detection import FaceError, decode_base64_image
from app.ml.face_embedding import (
    FaceConfig,
    aggregate_embeddings,
    cosine_similarity,
    deserialize_embedding,
    extract_single_embedding,
    serialize_embedding,
)
from app.models.user import User

logger = logging.getLogger("app.face")


def _cfg() -> FaceConfig:
    return FaceConfig(
        model=settings.INSIGHTFACE_MODEL,
        ctx_id=settings.INSIGHTFACE_CTX_ID,
        det_size=settings.INSIGHTFACE_DET_SIZE,
        min_det_score=settings.FACE_MIN_DET_SCORE,
        min_box_ratio=settings.FACE_MIN_BOX_RATIO,
        embedding_dim=settings.FACE_EMBEDDING_DIM,
    )


def _face_error_to_app(exc: FaceError) -> AppError:
    status = 503 if exc.code in {"ENGINE_UNAVAILABLE", "ENGINE_INIT_FAILED"} else 400
    return AppError(exc.message, status_code=status, error_code=exc.code)


@dataclass
class VerifyOutcome:
    matched: bool
    similarity: float


def _embed_many(images: List[str], cfg: FaceConfig):
    """Sync worker: decode + embed each image, keeping only clean single-face samples."""
    embeddings = []
    reasons: List[str] = []
    engine_error: FaceError | None = None
    for img in images:
        try:
            bgr = decode_base64_image(img)
            res = extract_single_embedding(bgr, cfg)
            embeddings.append(res.embedding)
        except FaceError as exc:
            if exc.code in {"ENGINE_UNAVAILABLE", "ENGINE_INIT_FAILED"}:
                engine_error = exc
                break
            reasons.append(exc.code)
    return embeddings, reasons, engine_error


def _embed_one(image: str, cfg: FaceConfig):
    bgr = decode_base64_image(image)
    return extract_single_embedding(bgr, cfg)


async def enroll(db: AsyncSession, user: User, images: List[str]) -> int:
    cfg = _cfg()
    embeddings, reasons, engine_error = await run_in_threadpool(_embed_many, images, cfg)

    if engine_error is not None:
        raise _face_error_to_app(engine_error)

    if len(embeddings) < settings.FACE_ENROLL_MIN_SAMPLES:
        detail = ""
        if "MULTIPLE_FACES" in reasons:
            detail = " Make sure only your face is visible."
        elif "FACE_TOO_SMALL" in reasons:
            detail = " Move closer to the camera."
        elif "NO_FACE" in reasons:
            detail = " Keep your face centered and well lit."
        raise AppError(
            f"Could not capture enough clear face samples "
            f"({len(embeddings)}/{settings.FACE_ENROLL_MIN_SAMPLES}).{detail}",
            status_code=400,
            error_code="ENROLL_INSUFFICIENT_SAMPLES",
        )

    template = aggregate_embeddings(embeddings)
    user.face_embedding = encrypt_bytes(serialize_embedding(template))
    user.is_face_enrolled = True
    await db.commit()
    logger.info("Face enrolled for user %s (%d samples)", user.id, len(embeddings))
    return len(embeddings)


async def verify(db: AsyncSession, user: User, image: str) -> VerifyOutcome:
    if not user.is_face_enrolled or not user.face_embedding:
        raise AppError(
            "No enrolled face on file. Please enroll your face first.",
            status_code=400, error_code="NOT_ENROLLED",
        )
    cfg = _cfg()
    try:
        result = await run_in_threadpool(_embed_one, image, cfg)
    except FaceError as exc:
        raise _face_error_to_app(exc)

    stored = deserialize_embedding(decrypt_bytes(user.face_embedding))
    similarity = cosine_similarity(result.embedding, stored)
    matched = similarity >= settings.FACE_MATCH_THRESHOLD
    logger.info("Face verify user %s similarity=%.4f matched=%s", user.id, similarity, matched)
    return VerifyOutcome(matched=matched, similarity=float(similarity))


async def delete_enrollment(db: AsyncSession, user: User) -> None:
    user.face_embedding = None
    user.is_face_enrolled = False
    await db.commit()
    logger.info("Face data deleted for user %s", user.id)
