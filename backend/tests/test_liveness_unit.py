"""Pure unit tests for the server-side liveness decision logic."""
from app.ml.liveness import LivenessConfig, evaluate_challenge
from _helpers import samples_for, wrong_samples_for

CFG = LivenessConfig()
CHALLENGES = ["blink", "turn_left", "turn_right", "tilt_head", "look_up", "look_down"]


def test_genuine_challenges_pass():
    for ch in CHALLENGES:
        res = evaluate_challenge(ch, samples_for(ch), CFG)
        assert res.passed is True, f"{ch}: {res.reason}"
        assert res.score >= 0.6


def test_wrong_or_spoof_challenges_fail():
    for ch in CHALLENGES:
        res = evaluate_challenge(ch, wrong_samples_for(ch), CFG)
        assert res.passed is False, f"{ch} should have failed"


def test_static_photo_blink_rejected():
    static = [{"t": i * 100, "ear": 0.30, "face_count": 1, "confidence": 1.0} for i in range(8)]
    assert evaluate_challenge("blink", static, CFG).passed is False


def test_multiple_faces_rejected():
    s = samples_for("turn_left")
    s[3]["face_count"] = 2
    assert evaluate_challenge("turn_left", s, CFG).passed is False


def test_too_few_samples_rejected():
    # min_samples is now 3, so 2 samples must be rejected
    assert evaluate_challenge("blink", samples_for("blink")[:2], CFG).passed is False


def test_low_confidence_rejected():
    s = samples_for("turn_right")
    for x in s:
        x["confidence"] = 0.2
    assert evaluate_challenge("turn_right", s, CFG).passed is False


def test_turn_direction_is_sign_sensitive():
    # Turning right (positive yaw) must NOT satisfy a turn_left challenge.
    right = samples_for("turn_right")
    assert evaluate_challenge("turn_left", right, CFG).passed is False
