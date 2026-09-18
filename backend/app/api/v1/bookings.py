import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_current_venue, require_owner
from app.db.session import get_db
from app.models.booking import Booking
from app.models.enums import BookingStatus, PaymentStatus
from app.models.user import User
from app.models.venue import Venue
from app.schemas.booking import BookingCreate, BookingDetail, BookingOut, BookingStatusUpdate, BookingUpdate
from app.schemas.payment import PaymentCreate
from app.services import booking as booking_service

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", response_model=BookingDetail, status_code=201)
def create_booking(
    payload: BookingCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    user: User = Depends(get_current_user),
) -> BookingDetail:
    booking = booking_service.create_booking(db, venue.id, user.id, payload, idempotency_key)
    return booking_service.to_booking_detail(booking)


@router.get("", response_model=list[BookingOut])
def list_bookings(
    day: date | None = Query(default=None, alias="date"),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    status_filter: BookingStatus | None = Query(default=None, alias="status"),
    payment_status: PaymentStatus | None = Query(default=None),
    customer_id: uuid.UUID | None = None,
    q: str | None = Query(default=None, description="Search by customer name or phone"),
    field_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> list[BookingOut]:
    query = db.query(Booking).options(joinedload(Booking.customer), joinedload(Booking.payments)).filter(
        Booking.venue_id == venue.id
    )

    if day:
        start = datetime.combine(day, datetime.min.time())
        query = query.filter(Booking.starts_at >= start, Booking.starts_at < start + timedelta(days=1))
    if date_from:
        query = query.filter(Booking.starts_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Booking.starts_at < datetime.combine(date_to, datetime.min.time()) + timedelta(days=1))
    if status_filter:
        query = query.filter(Booking.status == status_filter)
    if customer_id:
        query = query.filter(Booking.customer_id == customer_id)
    if field_id:
        query = query.filter(Booking.field_id == field_id)

    bookings = query.order_by(Booking.starts_at.desc()).limit(500).all()

    if q:
        needle = q.strip().lower()
        bookings = [
            b for b in bookings
            if b.customer and (needle in b.customer.name.lower() or needle in b.customer.phone.lower())
        ]

    results = [booking_service.to_booking_out(b) for b in bookings]
    if payment_status:
        results = [r for r in results if r.payment_status == payment_status]
    return results


@router.get("/{booking_id}", response_model=BookingDetail)
def get_booking(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> BookingDetail:
    booking = booking_service.get_booking_or_404(db, venue.id, booking_id)
    return booking_service.to_booking_detail(booking)


@router.patch("/{booking_id}", response_model=BookingDetail)
def update_booking(
    booking_id: uuid.UUID,
    payload: BookingUpdate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> BookingDetail:
    booking = booking_service.update_booking(db, venue.id, booking_id, payload)
    return booking_service.to_booking_detail(booking)


@router.post("/{booking_id}/status", response_model=BookingDetail)
def update_status(
    booking_id: uuid.UUID,
    payload: BookingStatusUpdate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    user: User = Depends(get_current_user),
) -> BookingDetail:
    booking = booking_service.change_status(db, venue.id, booking_id, payload.status, user.id, payload.reason)
    return booking_service.to_booking_detail(booking)


@router.post("/{booking_id}/payments", response_model=BookingDetail)
def add_payment(
    booking_id: uuid.UUID,
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    user: User = Depends(get_current_user),
) -> BookingDetail:
    booking = booking_service.record_payment(
        db, venue.id, booking_id, user.id, payload.amount, payload.method, payload.direction, payload.reference, payload.note
    )
    return booking_service.to_booking_detail(booking)


@router.delete("/{booking_id}/payments/{payment_id}", response_model=BookingDetail)
def remove_payment(
    booking_id: uuid.UUID,
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    user: User = Depends(require_owner),
) -> BookingDetail:
    booking = booking_service.delete_payment(db, venue.id, booking_id, payment_id, user.id)
    return booking_service.to_booking_detail(booking)
