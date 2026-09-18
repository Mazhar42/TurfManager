"""Password hashing and JWT access/refresh token helpers."""
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()
_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def _create_token(subject: str, role: str, venue_id: str, expires_delta: timedelta, token_type: TokenType) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "venue_id": venue_id,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, role: str, venue_id: str) -> str:
    return _create_token(
        user_id, role, venue_id, timedelta(minutes=settings.access_token_expire_minutes), "access"
    )


def create_refresh_token(user_id: str, role: str, venue_id: str) -> str:
    return _create_token(
        user_id, role, venue_id, timedelta(days=settings.refresh_token_expire_days), "refresh"
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def hash_refresh_token(token: str) -> str:
    """Refresh tokens are stored hashed so a leaked DB doesn't hand out live sessions."""
    return hashlib.sha256(token.encode()).hexdigest()


def new_idempotency_key() -> str:
    return secrets.token_urlsafe(16)
