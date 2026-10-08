from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.core.errors import InvalidCredentialsError, InvalidTokenError, TooManyAttemptsError
from app.core.ratelimit import FailureLimiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    verify_password,
)
from app.db.session import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenPair, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
login_limiter = FailureLimiter(settings.login_max_failures, settings.login_failure_window_minutes * 60)


def _client_ip(request: Request) -> str:
    # Behind Caddy, the real client is the first X-Forwarded-For hop.
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _issue_tokens(db: Session, user: User) -> TokenPair:
    access = create_access_token(str(user.id), user.role.value, str(user.venue_id))
    refresh = create_refresh_token(str(user.id), user.role.value, str(user.venue_id))

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    keys = (f"phone:{payload.phone}", f"ip:{_client_ip(request)}")
    wait = login_limiter.retry_after(*keys)
    if wait:
        raise TooManyAttemptsError(wait)

    user = db.query(User).filter(User.phone == payload.phone).one_or_none()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        login_limiter.record_failure(*keys)
        raise InvalidCredentialsError()
    login_limiter.reset(keys[0])
    return _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    try:
        claims = decode_token(payload.refresh_token)
    except Exception as exc:
        raise InvalidTokenError() from exc
    if claims.get("type") != "refresh":
        raise InvalidTokenError()

    token_hash = hash_refresh_token(payload.refresh_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).one_or_none()
    if not stored or stored.revoked_at is not None or stored.expires_at < datetime.now(UTC):
        raise InvalidTokenError()

    user = db.get(User, stored.user_id)
    if not user or not user.is_active:
        raise InvalidTokenError()

    stored.revoked_at = datetime.now(UTC)
    db.commit()
    return _issue_tokens(db, user)


@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)) -> None:
    token_hash = hash_refresh_token(payload.refresh_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).one_or_none()
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.now(UTC)
        db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
