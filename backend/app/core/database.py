"""Async SQLAlchemy engine, session factory and Base declarative class."""
from __future__ import annotations

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def _engine_kwargs() -> dict:
    kwargs: dict = {"echo": settings.SQL_ECHO, "future": True}
    # SQLite (used in tests) needs a couple of special flags.
    if settings.DATABASE_URL.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20
    return kwargs


engine = create_async_engine(settings.database_url_async, **_engine_kwargs())

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a database session and always closes it."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_models() -> None:
    """Create all tables. Used for dev (AUTO_CREATE_TABLES) and tests.

    Production should use Alembic migrations instead.
    """
    # Import models so they register on Base.metadata before create_all.
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured (create_all).")


async def dispose_engine() -> None:
    await engine.dispose()
