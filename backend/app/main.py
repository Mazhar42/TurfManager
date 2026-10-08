from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.errors import ApiError, api_error_handler, unhandled_error_handler, validation_error_handler
from app.core.logging import RequestLogMiddleware, configure_logging
from app.db import session as db_session

settings = get_settings()
configure_logging(settings)

# Interactive docs and the OpenAPI schema are served under /api (so the Caddy proxy and
# the Vite dev proxy both reach them) and only outside production.
_docs_prefix = settings.api_prefix
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    openapi_url=None if settings.is_production else f"{_docs_prefix}/openapi.json",
    docs_url=None if settings.is_production else f"{_docs_prefix}/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(RequestLogMiddleware)

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["health"])
def health() -> JSONResponse:
    """Liveness *and* readiness: the API is only useful if it can reach Postgres, so the
    container healthcheck and the post-deploy smoke test both go through the database."""
    try:
        with db_session.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unreachable"})
    return JSONResponse(content={"status": "ok", "database": "ok"})
