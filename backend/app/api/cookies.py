"""Refresh-token cookie helpers.

The refresh token is stored in an HttpOnly cookie so JavaScript cannot read it
(mitigates XSS token theft). It is scoped to the auth path so it is not sent to
every request.
"""
from __future__ import annotations

from starlette.responses import Response

from app.core.config import settings

_COOKIE_PATH = f"{settings.API_PREFIX}/auth"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path=_COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path=_COOKIE_PATH,
    )
