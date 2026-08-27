"""Lightweight in-process protections: request-body size cap and a fixed-window
per-IP rate limiter.

NOTE: the rate limiter state lives in this process only. Behind multiple workers
or replicas you should front the app with a shared limiter (e.g. Redis / nginx).
This is documented in the README.
"""
from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_bytes: int):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                if int(cl) > self.max_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "success": False,
                            "message": "Request payload too large.",
                            "error_code": "PAYLOAD_TOO_LARGE",
                        },
                    )
            except ValueError:
                pass
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed 60s window keyed by client IP. Applies only to the API prefix."""

    def __init__(self, app, limit_per_minute: int, api_prefix: str = "/api"):
        super().__init__(app)
        self.limit = limit_per_minute
        self.api_prefix = api_prefix
        self._hits: dict[str, list] = defaultdict(list)
        self._lock = Lock()

    def _client_ip(self, request: Request) -> str:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        if self.limit <= 0 or not request.url.path.startswith(self.api_prefix):
            return await call_next(request)

        now = time.time()
        window_start = now - 60.0
        key = self._client_ip(request)
        with self._lock:
            bucket = self._hits[key]
            # Drop timestamps older than the window.
            fresh = [t for t in bucket if t >= window_start]
            fresh.append(now)
            self._hits[key] = fresh
            count = len(fresh)

        if count > self.limit:
            retry_after = 60
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "message": "Too many requests. Please slow down.",
                    "error_code": "RATE_LIMITED",
                },
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)
