"""The booking service. The one rule that matters: we never pre-check availability and
then trust it — we attempt the insert and let PostgreSQL's exclusion constraint be the
single source of truth, catching the resulting IntegrityError and turning it into a clean
409 SLOT_TAKEN. The pre-check in `get_conflicting_booking` exists only to make the UI
pleasant (and to report *who* holds the conflicting slot); it is never relied on for safety.
"""
import uuid
import zoneinfo
from datetime import UTC, datetime
from decimal import Decimal

from psycopg import errors as pg_errors
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.core.errors import (
    InvalidStatusTransitionError,
    NotFoundError,
    OutsideOpeningHoursError,
    OverpaymentError,
    SlotTakenError,
)
from app.models.booking import Booking
from app.models.booking_event import BookingEvent
from app.models.customer import Customer
from app.models.enums import BOOKING_STATUS_TRANSITIONS, BookingStatus, PaymentDirection, PaymentMethod
from app.models.field import Field
from app.models.payment import Payment
from app.models.venue import Venue
from app.schemas.booking import BookingCreate, BookingDetail, BookingEventOut, BookingOut, BookingUpdate
from app.schemas.customer import CustomerOut
from app.schemas.payment import PaymentOut
from app.services import payments as payment_calc
from app.services.pricing import resolve_price


def _is_slot_conflict(exc: Exception) -> bool:
    """Both ways PostgreSQL can reject the loser of a race for the same slot.

    Usually it's an exclusion violation (an IntegrityError). But when two transactions
    insert overlapping rows at the same instant, each waits on the other's uncommitted
    row while checking the constraint, and Postgres resolves that by aborting one with a
    deadlock error instead. Either way the slot belongs to the other booking.
    """
    if isinstance(exc, IntegrityError):
        return True
    return isinstance(exc, OperationalError) and isinstance(
        exc.orig, pg_errors.DeadlockDetected | pg_errors.SerializationFailure
    )


def _get_or_create_customer(
    db: Session, venue_id: uuid.UUID, customer_id: uuid.UUID | None, name: str | None, phone: str | None
) -> Customer:
    if customer_id:
        customer = db.get(Customer, customer_id)
        if not customer or customer.venue_id != venue_id:
            raise NotFoundError("Customer")
        return customer

    existing = db.query(Customer).filter(Customer.venue_id == venue_id, Customer.phone == phone).one_or_none()
    if existing:
        return existing

    # Savepoint: two bookings for the same brand-new phone number can race here too.
    try:
        with db.begin_nested():
            customer = Customer(venue_id=venue_id, name=name, phone=phone)
            db.add(customer)
    except IntegrityError:
        customer = db.query(Customer).filter(Customer.venue_id == venue_id, Customer.phone == phone).one()
    return customer


def localize(venue: Venue, dt: datetime) -> datetime:
    """A datetime with no offset (e.g. from a form that only knows the venue's local
    clock) is assumed to be in the venue's own timezone, not the server's."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=zoneinfo.ZoneInfo(venue.timezone))
    return dt


def _assert_within_opening_hours(venue: Venue, starts_at: datetime, ends_at: datetime) -> None:
    # Compare on the venue's wall clock: a client may send UTC (or any offset), and
    # 14:00Z is 20:00 in Dhaka, not 14:00.
    tz = zoneinfo.ZoneInfo(venue.timezone)
    local_start, local_end = starts_at.astimezone(tz), ends_at.astimezone(tz)
    if local_start.date() != local_end.date():
        raise OutsideOpeningHoursError()
    if local_start.time() < venue.opens_at or local_end.time() > venue.closes_at:
        raise OutsideOpeningHoursError()


def get_conflicting_booking(db: Session, field_id: uuid.UUID, starts_at: datetime, ends_at: datetime) -> Booking | None:
    """Best-effort pre-check so the UI can say who holds a slot. Not a safety mechanism."""
    return (
        db.query(Booking)
        .filter(
            Booking.field_id == field_id,
            Booking.status.in_([s.value for s in (BookingStatus.pending, BookingStatus.confirmed, BookingStatus.completed)]),
            Booking.starts_at < ends_at,
            Booking.ends_at > starts_at,
        )
        .first()
    )


def _assert_not_blocked(db: Session, field_id: uuid.UUID, starts_at: datetime, ends_at: datetime) -> None:
    blocked = db.execute(
        text(
            "SELECT id, reason FROM blocked_slots "
            "WHERE field_id = :field_id AND slot && tstzrange(:starts_at, :ends_at, '[)') "
            "LIMIT 1"
        ),
        {"field_id": str(field_id), "starts_at": starts_at, "ends_at": ends_at},
    ).first()
    if blocked:
        raise SlotTakenError({"reason": "blocked", "blocked_reason": blocked.reason})


def create_booking(
    db: Session, venue_id: uuid.UUID, created_by: uuid.UUID, data: BookingCreate, idempotency_key: str | None = None
) -> Booking:
    if idempotency_key:
        existing = db.query(Booking).filter(Booking.idempotency_key == idempotency_key).one_or_none()
        if existing:
            return existing

    field = db.get(Field, data.field_id)
    if not field or field.venue_id != venue_id:
        raise NotFoundError("Field")
    venue = db.get(Venue, venue_id)

    starts_at = localize(venue, data.starts_at)
    ends_at = localize(venue, data.ends_at)

    if starts_at >= ends_at:
        raise OutsideOpeningHoursError()
    _assert_within_opening_hours(venue, starts_at, ends_at)
    _assert_not_blocked(db, data.field_id, starts_at, ends_at)

    customer = _get_or_create_customer(db, venue_id, data.customer_id, data.customer_name, data.customer_phone)

    if data.price_amount is not None:
        price = data.price_amount
    else:
        price, _rule = resolve_price(db, venue_id, data.field_id, starts_at, ends_at)

    booking = Booking(
        venue_id=venue_id,
        field_id=data.field_id,
        customer_id=customer.id,
        starts_at=starts_at,
        ends_at=ends_at,
        status=data.status,
        price_amount=price,
        notes=data.notes,
        created_by=created_by,
        idempotency_key=idempotency_key,
    )
    db.add(booking)

    try:
        db.flush()
    except (IntegrityError, OperationalError) as exc:
        if not _is_slot_conflict(exc):
            raise
        db.rollback()
        conflict = get_conflicting_booking(db, data.field_id, starts_at, ends_at)
        details = {}
        if conflict:
            details = {
                "conflicting_booking_id": str(conflict.id),
                "customer_name": conflict.customer.name if conflict.customer else None,
                "starts_at": conflict.starts_at.isoformat(),
                "ends_at": conflict.ends_at.isoformat(),
            }
        raise SlotTakenError(details) from exc

    db.add(BookingEvent(booking_id=booking.id, actor_user_id=created_by, event_type="created", to_status=booking.status.value))

    if data.advance_amount and data.advance_amount > 0:
        method = PaymentMethod(data.advance_method) if data.advance_method else PaymentMethod.cash
        db.add(
            Payment(
                booking_id=booking.id,
                amount=data.advance_amount,
                method=method,
                direction=PaymentDirection.payment,
                received_by=created_by,
            )
        )
        db.add(
            BookingEvent(
                booking_id=booking.id,
                actor_user_id=created_by,
                event_type="payment_recorded",
                payload={"amount": str(data.advance_amount), "method": method.value},
            )
        )

    db.commit()
    db.refresh(booking)
    return booking


def update_booking(
    db: Session, venue_id: uuid.UUID, booking_id: uuid.UUID, data: BookingUpdate, actor_id: uuid.UUID
) -> Booking:
    booking = get_booking_or_404(db, venue_id, booking_id)
    venue = db.get(Venue, venue_id)

    new_starts = localize(venue, data.starts_at) if data.starts_at else booking.starts_at
    new_ends = localize(venue, data.ends_at) if data.ends_at else booking.ends_at
    new_field = data.field_id or booking.field_id

    if new_starts >= new_ends:
        raise OutsideOpeningHoursError()

    if data.field_id and data.field_id != booking.field_id:
        field = db.get(Field, data.field_id)
        if not field or field.venue_id != venue_id:
            raise NotFoundError("Field")

    moved = new_starts != booking.starts_at or new_ends != booking.ends_at or new_field != booking.field_id
    repriced = data.price_amount is not None and data.price_amount != booking.price_amount
    before = {
        "starts_at": booking.starts_at.isoformat(),
        "ends_at": booking.ends_at.isoformat(),
        "field_id": str(booking.field_id),
        "price_amount": str(booking.price_amount),
    }

    if moved:
        _assert_within_opening_hours(venue, new_starts, new_ends)
        _assert_not_blocked(db, new_field, new_starts, new_ends)
        conflict = get_conflicting_booking(db, new_field, new_starts, new_ends)
        if conflict and conflict.id != booking.id:
            raise SlotTakenError({"conflicting_booking_id": str(conflict.id)})

    booking.starts_at = new_starts
    booking.ends_at = new_ends
    booking.field_id = new_field
    if data.price_amount is not None:
        booking.price_amount = data.price_amount
    if data.notes is not None:
        booking.notes = data.notes

    try:
        db.flush()
    except (IntegrityError, OperationalError) as exc:
        if not _is_slot_conflict(exc):
            raise
        db.rollback()
        raise SlotTakenError() from exc

    if moved or repriced:
        after = {
            "starts_at": booking.starts_at.isoformat(),
            "ends_at": booking.ends_at.isoformat(),
            "field_id": str(booking.field_id),
            "price_amount": str(booking.price_amount),
        }
        db.add(
            BookingEvent(
                booking_id=booking.id,
                actor_user_id=actor_id,
                event_type="rescheduled" if moved else "repriced",
                payload={"before": before, "after": after},
            )
        )

    db.commit()
    db.refresh(booking)
    return booking


def change_status(db: Session, venue_id: uuid.UUID, booking_id: uuid.UUID, new_status: BookingStatus, actor_id: uuid.UUID, reason: str | None) -> Booking:
    booking = get_booking_or_404(db, venue_id, booking_id)

    allowed = BOOKING_STATUS_TRANSITIONS.get(booking.status, set())
    if new_status not in allowed:
        raise InvalidStatusTransitionError(booking.status.value, new_status.value)

    old_status = booking.status
    booking.status = new_status
    if new_status == BookingStatus.cancelled:
        booking.cancelled_at = datetime.now(UTC)
        booking.cancel_reason = reason

    db.add(
        BookingEvent(
            booking_id=booking.id,
            actor_user_id=actor_id,
            event_type="status_changed",
            from_status=old_status.value,
            to_status=new_status.value,
            payload={"reason": reason} if reason else {},
        )
    )
    db.commit()
    db.refresh(booking)
    return booking


def record_payment(db: Session, venue_id: uuid.UUID, booking_id: uuid.UUID, actor_id: uuid.UUID, amount: Decimal, method: PaymentMethod, direction: PaymentDirection, reference: str | None, note: str | None) -> Booking:
    booking = get_booking_or_404(db, venue_id, booking_id)

    if direction == PaymentDirection.payment:
        due = payment_calc.due_amount(booking)
        if amount > due:
            raise OverpaymentError(str(due))
    else:
        already_paid = payment_calc.paid_amount(booking)
        if amount > already_paid:
            raise OverpaymentError(str(already_paid))

    payment = Payment(
        booking_id=booking.id, amount=amount, method=method, direction=direction, reference=reference,
        received_by=actor_id, note=note,
    )
    db.add(payment)
    db.add(
        BookingEvent(
            booking_id=booking.id, actor_user_id=actor_id, event_type="payment_recorded",
            payload={"amount": str(amount), "method": method.value, "direction": direction.value},
        )
    )
    db.commit()
    db.refresh(booking)
    return booking


def delete_payment(db: Session, venue_id: uuid.UUID, booking_id: uuid.UUID, payment_id: uuid.UUID, actor_id: uuid.UUID) -> Booking:
    booking = get_booking_or_404(db, venue_id, booking_id)
    payment = db.get(Payment, payment_id)
    if not payment or payment.booking_id != booking.id:
        raise NotFoundError("Payment")

    db.delete(payment)
    db.add(
        BookingEvent(
            booking_id=booking.id, actor_user_id=actor_id, event_type="payment_deleted",
            payload={"amount": str(payment.amount), "method": payment.method.value},
        )
    )
    db.commit()
    db.refresh(booking)
    return booking


def get_booking_or_404(db: Session, venue_id: uuid.UUID, booking_id: uuid.UUID) -> Booking:
    booking = db.get(Booking, booking_id)
    if not booking or booking.venue_id != venue_id:
        raise NotFoundError("Booking")
    return booking


def to_booking_out(booking: Booking) -> BookingOut:
    return BookingOut(
        id=booking.id,
        field_id=booking.field_id,
        starts_at=booking.starts_at,
        ends_at=booking.ends_at,
        status=booking.status,
        price_amount=booking.price_amount,
        notes=booking.notes,
        customer=CustomerOut.model_validate(booking.customer),
        paid_amount=payment_calc.paid_amount(booking),
        due_amount=payment_calc.due_amount(booking),
        payment_status=payment_calc.payment_status(booking),
    )


def to_booking_detail(booking: Booking) -> BookingDetail:
    base = to_booking_out(booking)
    return BookingDetail(
        **base.model_dump(),
        payments=[PaymentOut.model_validate(p) for p in sorted(booking.payments, key=lambda p: p.received_at)],
        events=[
            BookingEventOut(
                id=e.id,
                event_type=e.event_type,
                from_status=e.from_status,
                to_status=e.to_status,
                payload=e.payload or {},
                actor_name=e.actor.name if e.actor else None,
                created_at=e.created_at,
            )
            # Events written in one transaction share a now() timestamp — keep "created" first.
            for e in sorted(booking.events, key=lambda e: (e.created_at, e.event_type != "created"))
        ],
    )
