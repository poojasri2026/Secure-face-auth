"""Application-level exception used to produce consistent API error envelopes."""
from __future__ import annotations

from typing import Optional


class AppError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or "APP_ERROR"
