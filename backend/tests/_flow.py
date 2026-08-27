"""Reusable async helpers that drive the real HTTP MFA flow end to end."""
from __future__ import annotations

from _helpers import samples_for

PASSWORD = "Str0ng!Pass1"
API = "/api"


async def register(client, email, password=PASSWORD, name="Test User"):
    return await client.post(
        f"{API}/auth/register",
        json={"full_name": name, "email": email, "password": password,
              "confirm_password": password},
    )


async def verify_email(client, sent, email):
    return await client.post(
        f"{API}/auth/verify-email",
        json={"email": email, "code": sent["code"], "purpose": "registration"},
    )


async def enroll(client, token, images=None):
    images = images or ["genuine-1", "genuine-2", "genuine-3"]
    return await client.post(
        f"{API}/face/enroll", json={"images": images},
        headers={"Authorization": f"Bearer {token}"},
    )


async def login(client, email, password=PASSWORD):
    return await client.post(f"{API}/auth/login", json={"email": email, "password": password})


async def verify_otp(client, sent, mfa_token):
    return await client.post(
        f"{API}/auth/verify-otp", json={"mfa_token": mfa_token, "code": sent["code"]}
    )


async def run_liveness(client, mfa_token):
    r = await client.post(f"{API}/liveness/start", json={"mfa_token": mfa_token})
    assert r.status_code == 200, r.text
    data = r.json()
    lt = data["liveness_token"]
    for ch in data["challenges"]:
        rc = await client.post(
            f"{API}/liveness/challenge",
            json={"liveness_token": lt, "challenge": ch, "samples": samples_for(ch)},
        )
        assert rc.status_code == 200, rc.text
        assert rc.json()["passed"] is True, rc.text
    return await client.post(
        f"{API}/liveness/complete", json={"mfa_token": mfa_token, "liveness_token": lt}
    )


async def face_verify(client, mfa_token, image="genuine"):
    return await client.post(
        f"{API}/face/verify", json={"mfa_token": mfa_token, "image": image}
    )


async def signup(client, sent, email, password=PASSWORD):
    """Register + verify email + enroll face. Returns after enrollment."""
    r = await register(client, email, password)
    assert r.status_code == 201, r.text
    ev = await verify_email(client, sent, email)
    assert ev.status_code == 200, ev.text
    token = ev.json()["enrollment_token"]
    er = await enroll(client, token)
    assert er.status_code == 200, er.text
    return er


async def full_login(client, sent, email, password=PASSWORD, image="genuine"):
    """Complete the full MFA login. Returns the final face-verify response."""
    lr = await login(client, email, password)
    assert lr.status_code == 200, lr.text
    mfa = lr.json()["mfa_token"]
    assert mfa, lr.text
    vo = await verify_otp(client, sent, mfa)
    assert vo.status_code == 200, vo.text
    lc = await run_liveness(client, mfa)
    assert lc.status_code == 200, lc.text
    return await face_verify(client, mfa, image)
