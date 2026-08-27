"""Pure unit tests for face embedding math (no InsightFace needed)."""
import numpy as np

from app.ml.face_embedding import (
    aggregate_embeddings,
    cosine_similarity,
    deserialize_embedding,
    l2_normalize,
    serialize_embedding,
)
from _helpers import GENUINE, IMPOSTOR


def test_cosine_identity():
    assert abs(cosine_similarity(GENUINE, GENUINE) - 1.0) < 1e-5


def test_cosine_distinct_low():
    assert cosine_similarity(GENUINE, IMPOSTOR) < 0.45


def test_l2_normalize_unit_length():
    v = np.array([3.0, 4.0], dtype="float32")
    n = l2_normalize(v)
    assert abs(np.linalg.norm(n) - 1.0) < 1e-6


def test_aggregate_is_unit_and_matches_source():
    tmpl = aggregate_embeddings([GENUINE, GENUINE, GENUINE])
    assert abs(np.linalg.norm(tmpl) - 1.0) < 1e-5
    assert cosine_similarity(GENUINE, tmpl) > 0.99


def test_serialize_roundtrip():
    tmpl = aggregate_embeddings([GENUINE, IMPOSTOR])
    back = deserialize_embedding(serialize_embedding(tmpl))
    assert np.allclose(back, tmpl, atol=1e-6)
