"""Real face embeddings via InsightFace (ArcFace, ONNX Runtime).

The model is loaded lazily as a process-wide singleton on first use. If the
InsightFace / onnxruntime packages or model weights are unavailable, a clear
FaceError is raised with installation guidance -- the system NEVER falls back
to a fake/simulated match.
"""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from app.ml.face_detection import FaceError, box_area_ratio

logger = logging.getLogger(__name__)

_analyzer = None
_lock = threading.Lock()


@dataclass
class FaceConfig:
    model: str = "buffalo_l"
    ctx_id: int = -1
    det_size: int = 640
    min_det_score: float = 0.55
    min_box_ratio: float = 0.10
    embedding_dim: int = 512


@dataclass
class EmbeddingResult:
    embedding: np.ndarray      # float32, L2-normalized, shape (dim,)
    det_score: float
    box_ratio: float


def get_analyzer(cfg: FaceConfig):
    """Lazily build and cache the InsightFace FaceAnalysis app."""
    global _analyzer
    if _analyzer is not None:
        return _analyzer
    with _lock:
        if _analyzer is not None:
            return _analyzer
        try:
            from insightface.app import FaceAnalysis
        except Exception as exc:  # pragma: no cover - depends on local install
            raise FaceError(
                "Face recognition engine is not installed. Install with "
                "`pip install insightface onnxruntime` (see backend/README.md).",
                "ENGINE_UNAVAILABLE",
            ) from exc

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if cfg.ctx_id >= 0
            else ["CPUExecutionProvider"]
        )
        try:
            app = FaceAnalysis(name=cfg.model, providers=providers)
            app.prepare(ctx_id=cfg.ctx_id, det_size=(cfg.det_size, cfg.det_size))
        except Exception as exc:  # pragma: no cover
            raise FaceError(
                "Failed to initialise the face model. On first run InsightFace "
                "downloads weights (~300MB); ensure network access or pre-place "
                f"the '{cfg.model}' pack under ~/.insightface/models. Details: {exc}",
                "ENGINE_INIT_FAILED",
            ) from exc
        _analyzer = app
        logger.info("InsightFace model '%s' ready (providers=%s).", cfg.model, providers)
        return _analyzer


def l2_normalize(v: np.ndarray) -> np.ndarray:
    v = np.asarray(v, dtype=np.float32).ravel()
    norm = np.linalg.norm(v)
    if norm < 1e-10:
        return v
    return v / norm


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = l2_normalize(a)
    b = l2_normalize(b)
    return float(np.dot(a, b))


def aggregate_embeddings(embeddings: List[np.ndarray]) -> np.ndarray:
    """Mean of unit vectors, re-normalized -> a robust enrollment template."""
    if not embeddings:
        raise FaceError("No embeddings to aggregate", "NO_EMBEDDINGS")
    stacked = np.vstack([l2_normalize(e) for e in embeddings])
    return l2_normalize(stacked.mean(axis=0))


def serialize_embedding(embedding: np.ndarray) -> bytes:
    return np.asarray(embedding, dtype=np.float32).ravel().tobytes()


def deserialize_embedding(data: bytes) -> np.ndarray:
    return np.frombuffer(data, dtype=np.float32).copy()


def extract_single_embedding(image_bgr: np.ndarray, cfg: FaceConfig) -> EmbeddingResult:
    """Detect exactly one good-quality face and return its embedding.

    Raises FaceError with a specific code for: no face, multiple faces,
    low detector confidence, or face too small/far.
    """
    app = get_analyzer(cfg)
    faces = app.get(image_bgr)

    if not faces:
        raise FaceError("No face detected", "NO_FACE")
    if len(faces) > 1:
        raise FaceError("Multiple faces detected", "MULTIPLE_FACES")

    face = faces[0]
    det_score = float(getattr(face, "det_score", 0.0) or 0.0)
    if det_score < cfg.min_det_score:
        raise FaceError("Face detection confidence too low", "LOW_CONFIDENCE")

    ratio = box_area_ratio(np.asarray(face.bbox), image_bgr.shape)
    if ratio < cfg.min_box_ratio:
        raise FaceError("Face is too small or too far from the camera", "FACE_TOO_SMALL")

    emb = getattr(face, "normed_embedding", None)
    if emb is None:
        emb = getattr(face, "embedding", None)
    if emb is None:
        raise FaceError("Could not compute a face embedding", "NO_EMBEDDING")

    return EmbeddingResult(l2_normalize(np.asarray(emb, dtype=np.float32)), det_score, ratio)
