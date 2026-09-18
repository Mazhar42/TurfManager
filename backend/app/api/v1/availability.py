import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_venue
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.field import Field
from app.models.user import User
from app.models.venue import Venue
from app.schemas.availability import DayAvailability
from app.services.availability import build_day_availability

router = APIRouter(prefix="/availability", tags=["availability"])


def _get_field(db: Session, venue: Venue, field_id: uuid.UUID) -> Field:
    field = db.get(Field, field_id)
    if not field or field.venue_id != venue.id:
        raise NotFoundError("Field")
    return field


@router.get("", response_model=DayAvailability)
def get_day_availability(
    field_id: uuid.UUID,
    day: date = Query(alias="date"),
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> DayAvailability:
    field = _get_field(db, venue, field_id)
    return build_day_availability(db, venue, field, day)


@router.get("/week", response_model=list[DayAvailability])
def get_week_availability(
    field_id: uuid.UUID,
    week_from: date = Query(alias="from"),
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> list[DayAvailability]:
    field = _get_field(db, venue, field_id)
    return [build_day_availability(db, venue, field, week_from + timedelta(days=i)) for i in range(7)]
