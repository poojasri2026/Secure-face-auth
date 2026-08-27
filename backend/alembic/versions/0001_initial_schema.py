"""Initial schema: users, otp_verifications, authentication_logs,
refresh_tokens, mfa_sessions, liveness_sessions.

The very first revision creates the schema directly from the SQLAlchemy models'
metadata. This guarantees the migrated schema is byte-for-byte identical to the
ORM definitions (correct portable UUID columns, non-native enums as VARCHAR,
JSON columns, and all indexes) without duplicating every column by hand.
Subsequent revisions should use explicit op.* operations / autogenerate.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.core.database import Base

# Ensure every model is registered on Base.metadata.
import app.models  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
