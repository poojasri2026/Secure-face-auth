# =====================================================================
# AI Secure MFA — backend image (FastAPI + InsightFace).
# Multi-stage: build wheels into a venv, then copy into a slim runtime.
# =====================================================================

# ---- Stage 1: build dependencies -----------------------------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

# insightface compiles native extensions; it needs a C/C++ toolchain + cmake.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Build everything into an isolated virtualenv we can copy wholesale.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY requirements.txt .
# insightface 0.7.3 builds native extensions against numpy at install time and
# is incompatible with numpy 2.x — install the pinned numpy (and Cython) first
# so its build finds them, then install the rest.
RUN pip install --upgrade pip setuptools wheel \
    && pip install "numpy==1.26.4" Cython \
    && pip install -r requirements.txt

# ---- Stage 2: runtime ----------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# Runtime shared libraries:
#   libglib2.0-0  -> required by opencv-python-headless
#   libgomp1      -> OpenMP runtime used by onnxruntime
#   curl          -> container HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Bring in the pre-built virtualenv (no build toolchain in the final image).
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY . .

# Non-root user; give it a home for the InsightFace model cache.
RUN chmod +x /app/docker-entrypoint.sh \
    && useradd --create-home --uid 10001 appuser \
    && mkdir -p /home/appuser/.insightface \
    && chown -R appuser:appuser /app /home/appuser
USER appuser

EXPOSE 8000

# Health endpoint is unauthenticated and cheap.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
