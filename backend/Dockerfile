# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /bin/uv

WORKDIR /app

# Dependencies first (cached unless pyproject/uv.lock change), exactly as locked, no dev extras.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .
RUN uv sync --frozen \
    && useradd --system --uid 10001 --home /app app \
    && chown -R app /app
USER app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

ENTRYPOINT ["./docker-entrypoint.sh"]

# Behind Caddy on a private Docker network: trust its X-Forwarded-* headers so request.client
# is the real phone, not the proxy. WEB_CONCURRENCY workers (default 2) suit a small VPS.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips '*' --no-server-header"]
