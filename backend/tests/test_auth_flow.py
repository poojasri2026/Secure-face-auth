"""End-to-end MFA happy paths through the real HTTP stack."""
import _flow as F


async def test_full_register_enroll_login_flow(client, sent):
    email = "alice@example.com"
    await F.signup(client, sent, email)

    fv = await F.full_login(client, sent, email, image="genuine")
    assert fv.status_code == 200, fv.text
    body = fv.json()
    assert body["success"] is True
    assert body["access_token"]           # final token only issued after all stages
    assert body["state"] == "MFA_COMPLETE"

    # Access token works on a protected route.
    me = await client.get(
        "/api/users/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    data = me.json()
    assert data["email"] == email
    assert data["is_face_enrolled"] is True
    assert data["is_email_verified"] is True


async def test_refresh_and_logout(client, sent):
    email = "bob@example.com"
    await F.signup(client, sent, email)
    fv = await F.full_login(client, sent, email)
    assert fv.status_code == 200

    # Refresh cookie was set; rotation returns a new access token.
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]

    # Logout clears the session; subsequent refresh fails.
    lo = await client.post("/api/auth/logout")
    assert lo.status_code == 200
    r2 = await client.post("/api/auth/refresh")
    assert r2.status_code == 401


async def test_refresh_token_rotation_detects_reuse(client, sent):
    email = "carol@example.com"
    await F.signup(client, sent, email)
    await F.full_login(client, sent, email)

    # Grab the current refresh cookie, rotate once, then replay the OLD token.
    old = client.cookies.get("mfa_refresh_token")
    assert old
    r1 = await client.post("/api/auth/refresh")
    assert r1.status_code == 200

    # Replay the old (now-rotated) token by forcing the cookie back.
    client.cookies.clear()
    client.cookies.set("mfa_refresh_token", old)
    r2 = await client.post("/api/auth/refresh")
    assert r2.status_code == 401
    assert r2.json()["error_code"] in ("REFRESH_REUSED", "REFRESH_NOT_FOUND")


async def test_login_before_enrollment_requires_face(client, sent):
    email = "dan@example.com"
    await F.register(client, email)
    ev = await F.verify_email(client, sent, email)
    assert ev.status_code == 200
    # Skip enrollment, then log in.
    lr = await F.login(client, email)
    assert lr.status_code == 200
    body = lr.json()
    assert body["next_step"] == "enroll_face"
    assert body.get("enrollment_token")
    assert "access_token" not in body      # no full session yet


async def test_login_requires_verified_email(client, sent):
    email = "erin@example.com"
    await F.register(client, email)
    lr = await F.login(client, email)
    assert lr.status_code == 403
    assert lr.json()["error_code"] == "EMAIL_NOT_VERIFIED"
