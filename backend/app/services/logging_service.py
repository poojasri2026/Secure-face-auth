"""Authentication event logging (spec sections 8, 22).

Failure events are committed immediately so they survive the request-scoped
rollback that happens when an endpoint raises.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_log import AuthenticationLog
from app.models.enums import AuthMethod, AuthStatus


def client_ip(request) -> Optional[str]:
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for") if request.headers else None
    if xff:
        return xff.split(",")[0].strip()[:64]
    client = getattr(request, "client", None)
    return client.host[:64] if client and client.host else None


def user_agent(request) -> Optional[str]:
    if request is None or not request.headers:
        return None
    ua = request.headers.get("user-agent")
    return ua[:512] if ua else None


async def record(
    db: AsyncSession,
    *,
    method: AuthMethod,
    status: AuthStatus,
    request=None,
    user=None,
    user_id=None,
    email: Optional[str] = None,
    failure_reason: Optional[str] = None,
    commit: bool = False,
) -> AuthenticationLog:
    log = AuthenticationLog(
        user_id=user_id if user_id is not None else (user.id if user else None),
        email=(email or (user.email if user else None)),
        authentication_method=method,
        status=status,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
        failure_reason=failure_reason[:255] if failure_reason else None,
    )
    db.add(log)
    if commit:
        await db.commit()
    else:
        await db.flush()
    return log
