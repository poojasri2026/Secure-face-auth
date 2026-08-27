"""Pytest fixtures.

Test environment is configured entirely via env vars set BEFORE the app is
imported: an isolated SQLite database, disabled rate limiting, and fixed dev
secrets. Email delivery and the InsightFace engine are patched so the tests run
without SMTP or the ONNX model — but the REAL server-side validators
(OTP hashing, JWT, cosine-threshold face match, liveness decisioning, MFA state
machine) all execute unchanged.
"""
from __future__ import annotations

import os

# --- Configure settings before importing the application ---
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_mfa.db"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["JWT_SECRET_KEY"] = "test-access-secret"
os.environ["JWT_REFRESH_SECRET_KEY"] = "test-refresh-secret"
os.environ["OTP_PEPPER"] = "test-otp-pepper"
os.environ["RATE_LIMIT_PER_MINUTE"] = "0"
os.environ["OTP_RESEND_COOLDOWN_SECONDS"] = "0"
os.environ["SMTP_USERNAME"] = ""
os.environ["SMTP_PASSWORD"] = ""
os.environ.pop("BOOTSTRAP_ADMIN_EMAIL", None)
os.environ.pop("BOOTSTRAP_ADMIN_PASSWORD", None)

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from types import SimpleNamespace  # noqa: E402

import sys  # noqa: E402
sys.path.insert(0, os.path.dirname(__file__))
import _helpers as H  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import email_service, face_service  # noqa: E402

# Captured outbound OTPs (email is patched).
SENT: dict = {}


def _fake_embed_one(image, cfg):
    return SimpleNamespace(embedding=H.embedding_for(image))


def _fake_embed_many(images, cfg):
    return [H.embedding_for(im) for im in images], [], None


@pytest_asyncio.fixture(autouse=True)
async def _env(monkeypatch):
    SENT.clear()

    async def fake_send_otp(to_email, otp, purpose):
        SENT["to"] = to_email
        SENT["code"] = otp
        SENT["purpose"] = purpose

    monkeypatch.setattr(email_service, "send_otp_email", fake_send_otp)
    monkeypatch.setattr(face_service, "_embed_one", _fake_embed_one)
    monkeypatch.setattr(face_service, "_embed_many", _fake_embed_many)

    # Fresh schema per test for isolation.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def sent():
    return SENT


@pytest.fixture
def helpers():
    return H
