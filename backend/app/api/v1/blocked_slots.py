import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_venue, require_owner
from app.core.errors import NotFoundError, SlotTakenError
from app.db.session import get_db
from app.models.blocked_slot import BlockedSlot
from app.models.user import User
from app.models.venue import Venue
from app.schemas.blocked_slot import BlockedSlotCreate, BlockedSlotOut
from app.services.booking import localize

router = APIRouter(prefix="/blocked-slots", tags=["blocked-slots"])


@router.get("", response_model=list[BlockedSlotOut])
def list_blocked_slots(
    db: Session = Depends(get_db), venue: Venue = Depends(get_current_venue), _user: User = Depends(require_owner)
) -> list[BlockedSlotOut]:
    return (
        db.query(BlockedSlot)
        .filter(BlockedSlot.venue_id == venue.id)
        .order_by(BlockedSlot.starts_at.desc())
        .limit(200)
        .all()
    )


@router.post("", response_model=BlockedSlotOut, status_code=201)
def create_blocked_slot(
    payload: BlockedSlotCreate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    user: User = Depends(require_owner),
) -> BlockedSlotOut:
    data = payload.model_dump()
    data["starts_at"] = localize(venue, data["starts_at"])
    data["ends_at"] = localize(venue, data["ends_at"])
    block = BlockedSlot(venue_id=venue.id, created_by=user.id, **data)
    db.add(block)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise SlotTakenError() from exc
    db.refresh(block)
    return block


@router.delete("/{block_id}", status_code=204)
def delete_blocked_slot(
    block_id: uuid.UUID,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> None:
    block = db.get(BlockedSlot, block_id)
    if not block or block.venue_id != venue.id:
        raise NotFoundError("Blocked slot")
    db.delete(block)
    db.commit()
