import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_venue, require_owner
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.field import Field
from app.models.user import User
from app.models.venue import Venue
from app.schemas.field import FieldCreate, FieldOut, FieldUpdate
from app.schemas.venue import VenueOut, VenueUpdate

router = APIRouter(tags=["settings"])


@router.get("/settings/venue", response_model=VenueOut)
def get_venue(venue: Venue = Depends(get_current_venue), _user: User = Depends(get_current_user)) -> VenueOut:
    return venue


@router.patch("/settings/venue", response_model=VenueOut)
def update_venue(
    payload: VenueUpdate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> VenueOut:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(venue, field, value)
    db.commit()
    db.refresh(venue)
    return venue


@router.get("/fields", response_model=list[FieldOut])
def list_fields(
    db: Session = Depends(get_db), venue: Venue = Depends(get_current_venue), _user: User = Depends(get_current_user)
) -> list[FieldOut]:
    return db.query(Field).filter(Field.venue_id == venue.id).order_by(Field.sort_order.asc()).all()


@router.post("/fields", response_model=FieldOut, status_code=201)
def create_field(
    payload: FieldCreate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> FieldOut:
    field = Field(venue_id=venue.id, **payload.model_dump())
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.patch("/fields/{field_id}", response_model=FieldOut)
def update_field(
    field_id: uuid.UUID,
    payload: FieldUpdate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> FieldOut:
    field = db.get(Field, field_id)
    if not field or field.venue_id != venue.id:
        raise NotFoundError("Field")
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(field, name, value)
    db.commit()
    db.refresh(field)
    return field
