import uuid

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError, InvalidTokenError, NotFoundError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.models.venue import Venue

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise InvalidTokenError("Not authenticated.")
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError as exc:
        raise InvalidTokenError("Session expired, please log in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError() from exc

    if payload.get("type") != "access":
        raise InvalidTokenError()

    user = db.get(User, uuid.UUID(payload["sub"]))
    if not user or not user.is_active:
        raise InvalidTokenError("Account is no longer active.")
    return user


def get_current_venue(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Venue:
    venue = db.get(Venue, user.venue_id)
    if not venue:
        raise NotFoundError("Venue")
    return venue


def require_role(*roles: UserRole):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ForbiddenError("Only an owner can do that.")
        return user

    return _dep


require_owner = require_role(UserRole.owner)
