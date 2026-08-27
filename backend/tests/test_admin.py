"""Admin endpoint tests.

Admin users are inserted directly and an access token is minted, so we can test
the admin surface without driving a full MFA UI flow for the admin. The
authorization check itself (get_current_admin -> user loaded from DB ->
is_admin) runs for real.
"""
import uuid

import _flow as F
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token, hash_password
from app.models.auth_log import AuthenticationLog
from app.models.enums import AuthMethod, AuthStatus
from app.models.user import User


async def _make_user(*, email, admin=False, active=True, verified=True, enrolled=True):
    async with AsyncSessionLocal() as db:
        u = User(
            id=uuid.uuid4(),
            full_name="Admin" if admin else "Regular",
            email=email,
            password_hash=hash_password("Str0ng!Pass1"),
            is_email_verified=verified,
            is_face_enrolled=enrolled,
            is_active=active,
            is_admin=admin,
        )
        db.add(u)
        await db.commit()
        await db.refresh(u)
        return str(u.id)


async def _log(email, method=AuthMethod.MFA, status=AuthStatus.SUCCESS, user_id=None):
    async with AsyncSessionLocal() as db:
        db.add(
            AuthenticationLog(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id) if user_id else None,
                email=email,
                authentication_method=method,
                status=status,
            )
        )
        await db.commit()


def _auth(uid):
    return {"Authorization": f"Bearer {create_access_token(str(uid))}"}


async def test_dashboard_returns_stats(client):
    admin_id = await _make_user(email="admin@example.com", admin=True)
    await _make_user(email="u1@example.com")
    await _make_user(email="u2@example.com", enrolled=False)
    await _log("u1@example.com", AuthMethod.MFA, AuthStatus.SUCCESS)
    await _log("u2@example.com", AuthMethod.PASSWORD, AuthStatus.FAILED)
    await _log("attacker@example.com", AuthMethod.PASSWORD, AuthStatus.BLOCKED)

    r = await client.get("/api/admin/dashboard", headers=_auth(admin_id))
    assert r.status_code == 200, r.text
    body = r.json()
    stats = body["stats"]
    assert stats["total_users"] == 3
    assert stats["verified_users"] == 3
    assert stats["face_enrolled_users"] == 2
    assert stats["failed_logins"] >= 1
    assert stats["blocked_attempts"] >= 1
    assert len(body["login_activity"]) == 7
    assert isinstance(body["recent_events"], list)
    # Secrets must never leak through the dashboard payload.
    blob = r.text.lower()
    assert "password_hash" not in blob
    assert "otp_hash" not in blob
    assert "face_embedding" not in blob


async def test_list_users_and_search(client):
    admin_id = await _make_user(email="admin@example.com", admin=True)
    await _make_user(email="alice@example.com")
    await _make_user(email="bob@example.com")

    r = await client.get("/api/admin/users?page=1&page_size=10", headers=_auth(admin_id))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 3
    emails = {u["email"] for u in body["items"]}
    assert {"admin@example.com", "alice@example.com", "bob@example.com"} <= emails
    for u in body["items"]:
        assert "password_hash" not in u
        assert "face_embedding" not in u

    r2 = await client.get("/api/admin/users?q=alice", headers=_auth(admin_id))
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2["total"] == 1
    assert b2["items"][0]["email"] == "alice@example.com"


async def test_list_logs_filter_by_status(client):
    admin_id = await _make_user(email="admin@example.com", admin=True)
    await _log("x@example.com", AuthMethod.MFA, AuthStatus.SUCCESS)
    await _log("y@example.com", AuthMethod.PASSWORD, AuthStatus.FAILED)

    r = await client.get("/api/admin/logs?status=FAILED", headers=_auth(admin_id))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    assert all(item["status"] == "FAILED" for item in body["items"])


async def test_set_active_deactivates_user(client):
    admin_id = await _make_user(email="admin@example.com", admin=True)
    target_id = await _make_user(email="target@example.com")

    r = await client.post(
        f"/api/admin/users/{target_id}/set-active?active=false", headers=_auth(admin_id)
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is False


async def test_admin_cannot_deactivate_self(client):
    admin_id = await _make_user(email="admin@example.com", admin=True)
    r = await client.post(
        f"/api/admin/users/{admin_id}/set-active?active=false", headers=_auth(admin_id)
    )
    assert r.status_code == 400
    assert r.json()["error_code"] == "SELF_DEACTIVATE"


async def test_non_admin_forbidden(client):
    uid = await _make_user(email="regular@example.com", admin=False)
    for path in ("/api/admin/dashboard", "/api/admin/users", "/api/admin/logs"):
        r = await client.get(path, headers=_auth(uid))
        assert r.status_code == 403, f"{path}: {r.text}"
        assert r.json()["error_code"] == "FORBIDDEN"


async def test_admin_requires_authentication(client):
    r = await client.get("/api/admin/dashboard")
    assert r.status_code == 401
