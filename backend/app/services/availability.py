"""Build the slot grid for a field on a given day — the data behind the Today screen."""
import zoneinfo
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.blocked_slot import BlockedSlot
from app.models.booking import Booking
from app.models.enums import ACTIVE_BOOKING_STATUSES
from app.models.field import Field
from app.models.venue import Venue
from app.schemas.availability import DayAvailability, Slot, SlotBookingSummary
from app.services import payments as payment_calc
from app.services.pricing import resolve_price


def build_day_availability(db: Session, venue: Venue, field: Field, day: date) -> DayAvailability:
    tz = zoneinfo.ZoneInfo(venue.timezone)
    day_start_local = datetime.combine(day, venue.opens_at, tzinfo=tz)
    day_end_local = datetime.combine(day, venue.closes_at, tzinfo=tz)
    now = datetime.now(tz)

    bookings = (
        db.query(Booking)
        .filter(
            Booking.field_id == field.id,
            Booking.status.in_([s.value for s in ACTIVE_BOOKING_STATUSES]),
            Booking.starts_at < day_end_local,
            Booking.ends_at > day_start_local,
        )
        .all()
    )
    blocks = (
        db.query(BlockedSlot)
        .filter(
            BlockedSlot.field_id == field.id,
            BlockedSlot.starts_at < day_end_local,
            BlockedSlot.ends_at > day_start_local,
        )
        .all()
    )

    slots: list[Slot] = []
    step = timedelta(minutes=venue.slot_minutes)
    cursor = day_start_local
    while cursor < day_end_local:
        slot_end = min(cursor + step, day_end_local)

        booking = next((b for b in bookings if b.starts_at < slot_end and b.ends_at > cursor), None)
        block = next((bl for bl in blocks if bl.starts_at < slot_end and bl.ends_at > cursor), None)

        price, _rule = resolve_price(db, venue.id, field.id, cursor, slot_end)

        if booking:
            state = "booked"
            summary = SlotBookingSummary(
                booking_id=booking.id,
                customer_name=booking.customer.name if booking.customer else "",
                status=booking.status.value,
                payment_status=payment_calc.payment_status(booking).value,
                paid_amount=payment_calc.paid_amount(booking),
                due_amount=payment_calc.due_amount(booking),
            )
            slots.append(Slot(starts_at=cursor, ends_at=slot_end, state=state, price=booking.price_amount, booking=summary))
        elif block:
            slots.append(Slot(starts_at=cursor, ends_at=slot_end, state="blocked", price=price, blocked_reason=block.reason))
        elif slot_end <= now:
            slots.append(Slot(starts_at=cursor, ends_at=slot_end, state="past", price=price))
        else:
            slots.append(Slot(starts_at=cursor, ends_at=slot_end, state="available", price=price))

        cursor = slot_end

    return DayAvailability(field_id=field.id, date=day.isoformat(), slots=slots)
