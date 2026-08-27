"""Aggregate all route modules under a single API router."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import admin, auth, face, health, liveness, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(liveness.router)
api_router.include_router(face.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
