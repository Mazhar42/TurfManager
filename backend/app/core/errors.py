"""Stable error envelope shared by every endpoint, so clients branch on `code`, not prose."""
import logging

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


# --- Common, named errors used across services -----------------------------------------

class SlotTakenError(ApiError):
    def __init__(self, details: dict | None = None):
        super().__init__(
            "SLOT_TAKEN",
            "That slot was just booked or blocked by someone else.",
            status.HTTP_409_CONFLICT,
            details,
        )


class OutsideOpeningHoursError(ApiError):
    def __init__(self):
        super().__init__(
            "OUTSIDE_OPENING_HOURS",
            "The requested time falls outside the venue's opening hours.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )


class NotFoundError(ApiError):
    def __init__(self, entity: str):
        super().__init__("NOT_FOUND", f"{entity} not found.", status.HTTP_404_NOT_FOUND)


class ForbiddenError(ApiError):
    def __init__(self, message: str = "You don't have permission to do that."):
        super().__init__("FORBIDDEN", message, status.HTTP_403_FORBIDDEN)


class InvalidCredentialsError(ApiError):
    def __init__(self):
        super().__init__("INVALID_CREDENTIALS", "Phone or password is incorrect.", status.HTTP_401_UNAUTHORIZED)


class InvalidTokenError(ApiError):
    def __init__(self, message: str = "Session expired, please log in again."):
        super().__init__("INVALID_TOKEN", message, status.HTTP_401_UNAUTHORIZED)


class InvalidStatusTransitionError(ApiError):
    def __init__(self, from_status: str, to_status: str):
        super().__init__(
            "INVALID_STATUS_TRANSITION",
            f"Cannot move a booking from '{from_status}' to '{to_status}'.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )


class OverpaymentError(ApiError):
    def __init__(self, due: str):
        super().__init__(
            "OVERPAYMENT",
            f"That payment exceeds the outstanding due amount ({due}).",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )


class TooManyAttemptsError(ApiError):
    def __init__(self, retry_after_seconds: int):
        super().__init__(
            "TOO_MANY_ATTEMPTS",
            "Too many failed login attempts. Please wait a few minutes and try again.",
            status.HTTP_429_TOO_MANY_REQUESTS,
            {"retry_after_seconds": retry_after_seconds},
        )


class DuplicatePhoneError(ApiError):
    def __init__(self):
        super().__init__("DUPLICATE_PHONE", "A user with this phone number already exists.", status.HTTP_409_CONFLICT)


def _envelope(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_envelope(exc.code, exc.message, exc.details))


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=_envelope("VALIDATION_ERROR", "Some fields are invalid.", {"errors": exc.errors()}),
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # The traceback itself is logged by RequestLogMiddleware; this only shapes the reply,
    # which deliberately never includes str(exc).
    logging.getLogger("turfmanager").error("Returning 500 for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_envelope("INTERNAL_ERROR", "Something went wrong on our end."),
    )
