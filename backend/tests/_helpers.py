"""Test helpers: deterministic fake face embeddings and liveness sample
generators that exercise the REAL server-side decision logic.

These do NOT bypass authentication — they feed realistic numeric signals /
embeddings into the actual validators so the genuine pass/fail code runs.
"""
from __future__ import annotations

from typing import Dict, List

import numpy as np

DIM = 512


def _unit(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(DIM).astype("float32")
    return v / (np.linalg.norm(v) + 1e-9)


# Two nearly-orthogonal unit vectors: genuine matches itself (cosine ~1),
# impostor does not (cosine ~0), so the real threshold logic decides.
GENUINE = _unit(1)
IMPOSTOR = _unit(2)


def embedding_for(image: str) -> np.ndarray:
    return (IMPOSTOR if "impostor" in image.lower() else GENUINE).copy()


def _mk(t: float, **kw) -> Dict:
    base = dict(
        t=float(t), ear=None, yaw=None, pitch=None, roll=None,
        face_count=1, confidence=1.0, box_ratio=0.3,
    )
    base.update(kw)
    return base


def samples_for(challenge: str) -> List[Dict]:
    """Return a sample sequence that genuinely satisfies the challenge."""
    ts = [0, 100, 200, 300, 400, 500, 600, 700]
    c = challenge.lower()
    if c == "blink":
        ears = [0.30, 0.30, 0.15, 0.14, 0.30, 0.31, 0.30, 0.30]
        return [_mk(ts[i], ear=ears[i]) for i in range(len(ts))]
    if c in ("turn_left", "turn_right"):
        sgn = -1 if c == "turn_left" else 1
        yaws = [0, 5, 20, 24, 22, 8, 0, 0]
        return [_mk(ts[i], yaw=float(sgn * yaws[i])) for i in range(len(ts))]
    if c == "tilt_head":
        rolls = [0, 3, 16, 20, 18, 5, 0, 0]
        return [_mk(ts[i], roll=float(rolls[i])) for i in range(len(ts))]
    if c in ("look_up", "look_down"):
        sgn = 1 if c == "look_up" else -1
        pit = [0, 4, 16, 20, 18, 6, 0, 0]
        return [_mk(ts[i], pitch=float(sgn * pit[i])) for i in range(len(ts))]
    raise ValueError(f"unknown challenge {challenge}")


def wrong_samples_for(challenge: str) -> List[Dict]:
    """Return a sequence that should FAIL the challenge (spoof / wrong move)."""
    ts = [0, 100, 200, 300, 400, 500]
    c = challenge.lower()
    if c == "blink":
        return [_mk(ts[i], ear=0.30) for i in range(len(ts))]  # eyes never close
    if c == "turn_left":
        return [_mk(ts[i], yaw=float(v)) for i, v in enumerate([0, 4, 8, 10, 6, 0])]
    if c == "turn_right":
        return [_mk(ts[i], yaw=float(v)) for i, v in enumerate([0, -4, -8, -10, -6, 0])]
    if c == "tilt_head":
        return [_mk(ts[i], roll=float(v)) for i, v in enumerate([0, 2, 4, 5, 3, 0])]
    if c == "look_up":
        return [_mk(ts[i], pitch=float(v)) for i, v in enumerate([0, 2, 4, 5, 3, 0])]
    if c == "look_down":
        return [_mk(ts[i], pitch=float(v)) for i, v in enumerate([0, -2, -4, -5, -3, 0])]
    raise ValueError(f"unknown challenge {challenge}")
