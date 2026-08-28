"""FastAPI application factory and process wiring.

Security posture:
- All authentication decisions happen on the server (see routes/services).
- Errors are returned as a consistent envelope; internals are hidden in prod.
- CORS is restricted to configured origins and allows credentials (refresh cookie).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, dispose_engine, init_models
from app.core.errors import AppError
from app.middleware.rate_limit import BodySizeLimitMiddleware, RateLimitMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("app")


async def _bootstrap_admin() -> None:
    """Optionally create a first admin from env vars (idempotent)."""
    if not (settings.BOOTSTRAP_ADMIN_EMAIL and settings.BOOTSTRAP_ADMIN_PASSWORD):
        return
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.models.user import User

    email = settings.BOOTSTRAP_ADMIN_EMAIL.lower()
    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if existing:
            if not existing.is_admin:
                existing.is_admin = True
                await db.commit()
                logger.info("Promoted existing user to admin: %s", email)
            return
        admin = User(
            full_name=settings.BOOTSTRAP_ADMIN_NAME,
            email=email,
            password_hash=hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
            is_email_verified=True,
            is_active=True,
            is_admin=True,
        )
        db.add(admin)
        await db.commit()
        logger.info(
            "Bootstrapped admin %s (face enrollment still required on first login).", email
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.AUTO_CREATE_TABLES:
        await init_models()
    await _bootstrap_admin()
    logger.info("%s started in %s mode.", settings.APP_NAME, settings.ENVIRONMENT)
    try:
        yield
    finally:
        await dispose_engine()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        description="AI-powered multi-factor authentication (password + email OTP + "
        "liveness + face recognition). All decisions are server-side.",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # --- Middleware ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.onrender\.com)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(
        RateLimitMiddleware,
        limit_per_minute=settings.RATE_LIMIT_PER_MINUTE,
        api_prefix=settings.API_PREFIX,
    )
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.MAX_REQUEST_BYTES)

    # --- Exception handlers (consistent envelope) ---
    @app.exception_handler(AppError)
    async def _app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": exc.message, "error_code": exc.error_code},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError):
        details = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", []) if p != "body")
            details.append({"field": loc, "message": err.get("msg", "invalid")})
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "message": "Validation failed.",
                "error_code": "VALIDATION_ERROR",
                "details": details,
            },
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        message = (
            "Internal server error."
            if settings.is_production
            else f"Internal server error: {exc}"
        )
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": message, "error_code": "INTERNAL_ERROR"},
        )

    # --- Routes ---
    app.include_router(api_router, prefix=settings.API_PREFIX)

    @app.get("/", include_in_schema=False)
    async def root():
        return {"name": settings.APP_NAME, "docs": "/docs", "api": settings.API_PREFIX}

    return app


app = create_app()
