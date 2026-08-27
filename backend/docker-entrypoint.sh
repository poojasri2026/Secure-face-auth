#!/usr/bin/env bash
# =====================================================================
# Backend container entrypoint.
#   1. Wait for the database to accept connections.
#   2. Optionally apply Alembic migrations (RUN_MIGRATIONS=true, default).
#   3. Launch the ASGI server (uvicorn).
#
# All authentication logic lives in the app; this script only handles
# process/database orchestration. No secrets are embedded here — every
# value comes from the environment.
# =====================================================================
set -euo pipefail

echo "[entrypoint] Starting AI Secure MFA backend..."

# ---- 1. Wait for the database to be reachable ---------------------------
# Reuses the app's own sync-URL derivation (settings.database_url_sync) so we
# honour exactly the same DATABASE_URL the application uses. psycopg2 is a
# runtime dependency (used by Alembic) so it is always available here.
python <<'PY'
import sys, time
try:
    from app.core.config import settings
    url = settings.database_url_sync  # e.g. postgresql+psycopg2://...
except Exception as exc:  # a config import failure is fatal — surface it
    print(f"[entrypoint] Could not load settings: {exc}", file=sys.stderr)
    sys.exit(1)

if not url.startswith("postgresql"):
    scheme = url.split("://", 1)[0]
    print(f"[entrypoint] Non-Postgres database ({scheme}); skipping DB wait.")
    sys.exit(0)

from urllib.parse import urlparse
u = urlparse(url.replace("+psycopg2", "").replace("+asyncpg", ""))
import psycopg2

attempts = 30
for i in range(1, attempts + 1):
    try:
        psycopg2.connect(
            host=u.hostname,
            port=u.port or 5432,
            user=u.username,
            password=u.password,
            dbname=(u.path or "/").lstrip("/") or None,
            connect_timeout=3,
        ).close()
        print(f"[entrypoint] Database reachable after {i} attempt(s).")
        break
    except Exception as exc:
        print(f"[entrypoint] Waiting for database ({i}/{attempts})... {exc.__class__.__name__}")
        time.sleep(2)
else:
    print("[entrypoint] Database not reachable; giving up.", file=sys.stderr)
    sys.exit(1)
PY

# ---- 2. Apply migrations -------------------------------------------------
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "[entrypoint] Applying database migrations (alembic upgrade head)..."
    alembic upgrade head
else
    echo "[entrypoint] RUN_MIGRATIONS=${RUN_MIGRATIONS:-} — skipping migrations."
fi

# ---- 3. Launch the server ------------------------------------------------
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
echo "[entrypoint] Launching uvicorn on ${HOST}:${PORT}"
exec uvicorn app.main:app \
    --host "${HOST}" \
    --port "${PORT}" \
    --proxy-headers \
    --forwarded-allow-ips="*"
