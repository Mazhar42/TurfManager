import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_venue, require_owner
from app.core.errors import DuplicatePhoneError, NotFoundError
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.models.venue import Venue
from app.schemas.staff import StaffCreate, StaffOut, StaffUpdate

router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("", response_model=list[StaffOut])
def list_staff(
    db: Session = Depends(get_db), venue: Venue = Depends(get_current_venue), _user: User = Depends(require_owner)
) -> list[StaffOut]:
    return db.query(User).filter(User.venue_id == venue.id).order_by(User.name.asc()).all()


@router.post("", response_model=StaffOut, status_code=201)
def create_staff(
    payload: StaffCreate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> StaffOut:
    if db.query(User).filter(User.phone == payload.phone).one_or_none():
        raise DuplicatePhoneError()
    staff = User(
        venue_id=venue.id, name=payload.name, phone=payload.phone, role=payload.role,
        password_hash=hash_password(payload.password),
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.patch("/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: uuid.UUID,
    payload: StaffUpdate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> StaffOut:
    staff = db.get(User, staff_id)
    if not staff or staff.venue_id != venue.id:
        raise NotFoundError("Staff member")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        password = data.pop("password")
        if password:
            staff.password_hash = hash_password(password)
    for field, value in data.items():
        setattr(staff, field, value)
    db.commit()
    db.refresh(staff)
    return staff
