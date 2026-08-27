"""Server-side validation of active-liveness challenges.

Landmark extraction (EAR, head pose) happens in the browser for performance,
but the *decision* about whether a challenge was genuinely satisfied is made
here, on the server. This module is intentionally free of framework/config
imports (pure numpy + stdlib) so it can be unit-tested in isolation.

Sign conventions (the frontend is written to match these):
  * yaw  < 0  => head turned to the user's LEFT ;  yaw  > 0 => user's RIGHT
  * pitch > 0 => looking UP           ;  pitch < 0 => looking DOWN
  * roll       => head tilt (either direction)
All angles are in degrees; EAR is a unitless eye-aspect-ratio.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple


@dataclass
class LivenessConfig:
    ear_closed: float = 0.24
    ear_open: float = 0.26
    yaw_threshold: float = 7.0    # reduced: ~7° head turn is easily detectable
    pitch_threshold: float = 6.0  # reduced: ~6° up/down is a clear nod
    roll_threshold: float = 6.5   # reduced: ~6.5° tilt is visible
    min_samples: int = 3           # fewer samples needed before we can decide
    min_confidence: float = 0.30   # accept slightly lower confidence detections
    min_duration_ms: float = 80.0  # allow fast deliberate movements


@dataclass
class ChallengeResult:
    passed: bool
    score: float
    reason: str


CHALLENGE_INSTRUCTIONS: Dict[str, str] = {
    "blink": "Please blink your eyes",
    "turn_left": "Turn your head to the LEFT",
    "turn_right": "Turn your head to the RIGHT",
    "tilt_head": "Tilt your head to one side",
    "look_up": "Look UP",
    "look_down": "Look DOWN",
}

ALL_CHALLENGES: Tuple[str, ...] = tuple(CHALLENGE_INSTRUCTIONS.keys())


def _get(sample: Any, key: str, default: Any = None) -> Any:
    if isinstance(sample, dict):
        return sample.get(key, default)
    return getattr(sample, key, default)


def _series(samples: Sequence[Any], key: str) -> List[float]:
    out: List[float] = []
    for s in samples:
        v = _get(s, key)
        if v is not None:
            try:
                out.append(float(v))
            except (TypeError, ValueError):
                continue
    return out


def _precheck(samples: Sequence[Any], cfg: LivenessConfig) -> Optional[str]:
    if len(samples) < cfg.min_samples:
        return "Not enough frames captured; hold steady and try again"

    face_counts = [int(_get(s, "face_count", 1) or 0) for s in samples]
    if any(fc > 1 for fc in face_counts):
        return "Multiple faces detected"
    single_ratio = sum(1 for fc in face_counts if fc == 1) / len(face_counts)
    if single_ratio < 0.35:
        return "Face not consistently detected"

    confidences = [float(_get(s, "confidence", 1.0) or 0.0) for s in samples]
    if confidences and (sum(confidences) / len(confidences)) < cfg.min_confidence:
        return "Detection confidence too low"

    ts = _series(samples, "t")
    if len(ts) >= 2:
        duration = max(ts) - min(ts)
        if 0 < duration < cfg.min_duration_ms:
            return "Movement was too fast to be verified"
    return None


def _detect_blink(ears: List[float], cfg: LivenessConfig) -> ChallengeResult:
    if len(ears) < cfg.min_samples:
        return ChallengeResult(False, 0.0, "Could not read your eyes clearly")
    min_e = min(ears)
    max_e = max(ears)
    e_range = max_e - min_e
    if e_range < 0.025 and min_e > cfg.ear_closed:
        return ChallengeResult(False, round(e_range, 3), "No natural blink detected")

    state = "need_open"
    blinks = 0
    for e in ears:
        if state == "need_open" and e >= cfg.ear_open:
            state = "need_close"
        elif state == "need_close" and e <= cfg.ear_closed:
            state = "need_reopen"
        elif state == "need_reopen" and e >= cfg.ear_open:
            blinks += 1
            state = "need_close"

    # Accept if:
    # 1. State machine detected a complete blink cycle
    # 2. Distinct trough (min_e <= ear_closed and range >= 0.035)
    # 3. Relative eye closure (e.g. min_e <= max_e * 0.82 and range >= 0.03)
    is_blink = (
        blinks >= 1
        or (min_e <= cfg.ear_closed and e_range >= 0.035)
        or (min_e <= max_e * 0.82 and e_range >= 0.030 and min_e <= (cfg.ear_closed + 0.04))
    )
    if is_blink:
        score = min(1.0, max(0.75, 0.70 + 0.15 * max(1, blinks) + (e_range * 0.5)))
        return ChallengeResult(True, round(score, 3), "Blink detected")
    return ChallengeResult(False, round(min(0.5, e_range), 3), "No complete blink detected")


def _detect_directional(
    values: List[float], threshold: float, direction: str, cfg: LivenessConfig
) -> ChallengeResult:
    """Detect a directional head movement.

    Direction-sensitive: only the extreme in the *correct* direction counts.
    Accepts if the extreme reaches >= threshold.  The centre-return requirement
    has been removed so that users who start slightly off-centre still pass.
    """
    if len(values) < cfg.min_samples:
        return ChallengeResult(False, 0.0, "Could not track head movement")

    lo, hi = min(values), max(values)

    if direction == "neg":
        # e.g. turn_left: need yaw to go sufficiently negative
        extreme = lo
        reached = extreme <= -threshold
        magnitude = abs(extreme)
    elif direction == "pos":
        # e.g. turn_right / look_up: need value to go sufficiently positive
        extreme = hi
        reached = extreme >= threshold
        magnitude = abs(extreme)
    else:  # "any" — tilt_head: either direction is fine
        magnitude = max(abs(lo), abs(hi))
        reached = magnitude >= threshold

    if reached:
        score = min(1.0, max(0.75, magnitude / (threshold * 1.0)))
        return ChallengeResult(True, round(score, 3), "Movement detected")

    return ChallengeResult(
        False,
        round(min(0.5, magnitude / max(threshold, 1e-6)), 3),
        "Movement not large enough — try turning/tilting more clearly",
    )


def evaluate_challenge(
    challenge: str, samples: Sequence[Any], cfg: LivenessConfig
) -> ChallengeResult:
    """Return whether the given challenge was genuinely performed."""
    problem = _precheck(samples, cfg)
    if problem:
        return ChallengeResult(False, 0.0, problem)

    challenge = challenge.lower()
    if challenge == "blink":
        return _detect_blink(_series(samples, "ear"), cfg)
    if challenge == "turn_left":
        return _detect_directional(_series(samples, "yaw"), cfg.yaw_threshold, "neg", cfg)
    if challenge == "turn_right":
        return _detect_directional(_series(samples, "yaw"), cfg.yaw_threshold, "pos", cfg)
    if challenge == "tilt_head":
        return _detect_directional(_series(samples, "roll"), cfg.roll_threshold, "any", cfg)
    if challenge == "look_up":
        return _detect_directional(_series(samples, "pitch"), cfg.pitch_threshold, "pos", cfg)
    if challenge == "look_down":
        return _detect_directional(_series(samples, "pitch"), cfg.pitch_threshold, "neg", cfg)
    return ChallengeResult(False, 0.0, f"Unknown challenge '{challenge}'")
