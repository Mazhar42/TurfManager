"""Logging and error reporting.

Everything goes to stdout as one line per event — Docker captures it, `docker compose logs`
reads it, and the compose file rotates it. Each request gets an id (echoed back as
`X-Request-ID`) so a staff member's "it said something went wrong" can be matched to the
exact traceback in the logs.
"""
import logging
import sys
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import Settings

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

logger = logging.getLogger("turfmanager")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def configure_logging(settings: Settings) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(name)s] [req=%(request_id)s] %(message)s")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level.upper())
    # uvicorn's own access log would duplicate RequestLogMiddleware's line.
    logging.getLogger("uvicorn.access").disabled = True

    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=0.0,
            send_default_pii=False,
        )
        logger.info("Sentry error reporting enabled")


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Not reset afterwards on purpose: uvicorn runs each request in its own task, and
        # leaving it set lets the outermost unhandled-error handler log the same id.
        rid = (request.headers.get("X-Request-ID") or uuid.uuid4().hex)[:32]
        request_id_var.set(rid)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            raise
        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers["X-Request-ID"] = rid
        if request.url.path != "/health":
            logger.info("%s %s -> %s (%.0f ms)", request.method, request.url.path, response.status_code, elapsed_ms)
        return response
