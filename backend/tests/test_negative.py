"""Negative / anti-fake-auth tests.

These assert the spec's forbidden shortcuts do NOT exist:
  - no `if OTP == "123456"`  -> a hard-coded code is rejected
  - no `faceVerified = true` -> an impostor face is rejected
  - stages cannot be skipped by manipulating client state
  - brute force is locked out
"""
import _flow as F
from _helpers import wrong_samples_for, samples_for


def _wrong_code(real: str) -> str:
    return "000000" if real != "000000" else "111111"


async def test_wrong_otp_rejected(client, sent):
    email = "n1@example.com"
    await F.register(client, email)
    real = sent["code"]
    r = await client.post(
        "/api/auth/verify-email",
        json={"email": email, "code": _wrong_code(real), "purpose": "registration"},
    )
    assert r.status_code == 400
    assert r.json()["error_code"] == "OTP_INVALID"


async def test_hardcoded_123456_is_not_a_backdoor(client, sent):
    """Explicitly prove '123456' is not accepted unless it's the real code."""
    email = "n2@example.com"
    await F.register(client, email)
    real = sent["code"]
    if real == "123456":
        # Astronomically unlikely, but keep the test deterministic.
        return
    r = await client.post(
        "/api/auth/verify-email",
        json={"email": email, "code": "123456", "purpose": "registration"},
    )
    assert r.status_code == 400
    assert r.json()["success"] is False


async def test_otp_attempt_limit_enforced(client, sent):
    email = "n3@example.com"
    await F.register(client, email)
    real = sent["code"]
    wrong = _wrong_code(real)
    codes = []
    for _ in range(5):
        rr = await client.post(
            "/api/auth/verify-email",
            json={"email": email, "code": wrong, "purpose": "registration"},
        )
        codes.append(rr.json().get("error_code"))
    # After max attempts the code is locked out even if correct.
    final = await client.post(
        "/api/auth/verify-email",
        json={"email": email, "code": real, "purpose": "registration"},
    )
    assert final.status_code in (400, 429)
    assert final.json()["error_code"] in ("OTP_MAX_ATTEMPTS", "OTP_INVALID")


async def test_impostor_face_rejected(client, sent):
    email = "n4@example.com"
    await F.signup(client, sent, email)
    # Reach the face stage legitimately, then present a DIFFERENT face.
    lr = await F.login(client, email)
    mfa = lr.json()["mfa_token"]
    await F.verify_otp(client, sent, mfa)
    await F.run_liveness(client, mfa)
    fv = await F.face_verify(client, mfa, image="impostor-face")
    assert fv.status_code == 401
    assert fv.json()["error_code"] == "FACE_MISMATCH"
    assert "access_token" not in fv.json()


async def test_wrong_liveness_direction_fails(client, sent):
    email = "n5@example.com"
    await F.signup(client, sent, email)
    lr = await F.login(client, email)
    mfa = lr.json()["mfa_token"]
    await F.verify_otp(client, sent, mfa)

    start = await client.post("/api/liveness/start", json={"mfa_token": mfa})
    data = start.json()
    lt = data["liveness_token"]
    first = data["challenges"][0]
    rc = await client.post(
        "/api/liveness/challenge",
        json={"liveness_token": lt, "challenge": first, "samples": wrong_samples_for(first)},
    )
    assert rc.status_code == 200
    assert rc.json()["passed"] is False

    # Completion must be refused because challenges are not satisfied.
    comp = await client.post(
        "/api/liveness/complete", json={"mfa_token": mfa, "liveness_token": lt}
    )
    assert comp.status_code == 400
    assert comp.json()["error_code"] == "LIVENESS_INCOMPLETE"


async def test_cannot_skip_liveness_to_reach_face(client, sent):
    email = "n6@example.com"
    await F.signup(client, sent, email)
    lr = await F.login(client, email)
    mfa = lr.json()["mfa_token"]
    await F.verify_otp(client, sent, mfa)   # state = OTP_VERIFIED, liveness NOT done
    fv = await F.face_verify(client, mfa, image="genuine")
    assert fv.status_code == 409
    assert fv.json()["error_code"] == "MFA_STATE_INVALID"


async def test_cannot_verify_otp_without_valid_session(client):
    r = await client.post("/api/auth/verify-otp", json={"mfa_token": "bogus", "code": "123456"})
    assert r.status_code == 401
    assert r.json()["error_code"] == "MFA_SESSION_INVALID"


async def test_brute_force_lockout(client, sent):
    email = "n7@example.com"
    await F.signup(client, sent, email)
    for _ in range(5):
        bad = await F.login(client, email, password="Wr0ng!Password9")
        assert bad.status_code == 401
    # Correct password now blocked due to lockout.
    locked = await F.login(client, email)  # correct password
    assert locked.status_code == 401
    assert locked.json()["error_code"] == "ACCOUNT_LOCKED"


async def test_protected_route_requires_token(client):
    r = await client.get("/api/users/me")
    assert r.status_code == 401


async def test_weak_password_rejected(client):
    r = await client.post(
        "/api/auth/register",
        json={"full_name": "Weak", "email": "weak@example.com",
              "password": "weak", "confirm_password": "weak"},
    )
    assert r.status_code == 422
