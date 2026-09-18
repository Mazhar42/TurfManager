"""Daily and monthly reporting. Aggregated in Python over a bounded date range — simple,
correct, and fast enough at single-venue scale; there is no need for a warehouse here.
"""
import calendar
import uuid
import zoneinfo
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking
from app.models.enums import BookingStatus, PaymentDirection
from app.models.field import Field
from app.models.payment import Payment
from app.models.venue import Venue
from app.schemas.reports import (
    BookingsByHour,
    CollectionsByMethod,
    DailyReport,
    MonthlyReport,
    OutstandingReport,
    RevenueByDay,
    TodayCollections,
    TopCustomer,
)
from app.services import payments as payment_calc
from app.services.availability import build_day_availability
from app.services.booking import to_booking_out


def _bookings_overlapping(db: Session, venue_id: uuid.UUID, range_start: datetime, range_end: datetime) -> list[Booking]:
    return (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.payments))
        .filter(Booking.venue_id == venue_id, Booking.starts_at < range_end, Booking.starts_at >= range_start)
        .all()
    )


def daily_report(db: Session, venue: Venue, day: date) -> DailyReport:
    tz = zoneinfo.ZoneInfo(venue.timezone)
    day_start = datetime.combine(day, datetime.min.time(), tzinfo=tz)
    day_end = day_start + timedelta(days=1)

    bookings = _bookings_overlapping(db, venue.id, day_start, day_end)
    active = [b for b in bookings if b.status != BookingStatus.cancelled]
    cancelled = [b for b in bookings if b.status == BookingStatus.cancelled]

    gross = sum((b.price_amount for b in active), Decimal("0.00"))
    collected = sum((payment_calc.paid_amount(b) for b in active), Decimal("0.00"))
    outstanding = sum((payment_calc.due_amount(b) for b in active), Decimal("0.00"))

    available = 0
    fields = db.query(Field).filter(Field.venue_id == venue.id, Field.is_active.is_(True)).all()
    for field in fields:
        grid = build_day_availability(db, venue, field, day)
        available += sum(1 for s in grid.slots if s.state == "available")

    return DailyReport(
        date=day.isoformat(),
        bookings=len(active),
        gross_revenue=gross,
        collected=collected,
        outstanding=outstanding,
        cancelled=len(cancelled),
        available_slots=available,
    )


def monthly_report(db: Session, venue: Venue, year: int, month: int) -> MonthlyReport:
    tz = zoneinfo.ZoneInfo(venue.timezone)
    month_start = datetime(year, month, 1, tzinfo=tz)
    days_in_month = calendar.monthrange(year, month)[1]
    month_end = month_start + timedelta(days=days_in_month)

    bookings = _bookings_overlapping(db, venue.id, month_start, month_end)
    active = [b for b in bookings if b.status != BookingStatus.cancelled]
    cancelled = [b for b in bookings if b.status == BookingStatus.cancelled]

    gross = sum((b.price_amount for b in active), Decimal("0.00"))
    collected = sum((payment_calc.paid_amount(b) for b in active), Decimal("0.00"))
    outstanding = sum((payment_calc.due_amount(b) for b in active), Decimal("0.00"))
    booked_hours = sum(
        (Decimal((b.ends_at - b.starts_at).total_seconds() / 3600) for b in active), Decimal("0.00")
    )

    revenue_by_day: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    bookings_by_day: dict[str, int] = defaultdict(int)
    for b in active:
        key = b.starts_at.astimezone(tz).date().isoformat()
        revenue_by_day[key] += b.price_amount
        bookings_by_day[key] += 1

    bookings_by_hour: dict[int, int] = defaultdict(int)
    for b in active:
        bookings_by_hour[b.starts_at.astimezone(tz).hour] += 1

    spend_by_customer: dict[str, dict] = defaultdict(lambda: {"bookings": 0, "spent": Decimal("0.00"), "name": ""})
    for b in active:
        if not b.customer:
            continue
        entry = spend_by_customer[str(b.customer_id)]
        entry["bookings"] += 1
        entry["spent"] += b.price_amount
        entry["name"] = b.customer.name

    top_customers = sorted(
        (
            TopCustomer(customer_id=cid, name=v["name"], bookings=v["bookings"], total_spent=v["spent"])
            for cid, v in spend_by_customer.items()
        ),
        key=lambda t: t.total_spent,
        reverse=True,
    )[:5]

    return MonthlyReport(
        month=f"{year:04d}-{month:02d}",
        total_bookings=len(active),
        booked_hours=booked_hours,
        gross_revenue=gross,
        collected=collected,
        outstanding=outstanding,
        cancelled_bookings=len(cancelled),
        revenue_by_day=[
            RevenueByDay(date=d, revenue=revenue_by_day[d], bookings=bookings_by_day[d])
            for d in sorted(revenue_by_day)
        ],
        bookings_by_hour=[BookingsByHour(hour=h, bookings=c) for h, c in sorted(bookings_by_hour.items())],
        top_customers=top_customers,
    )


def today_collections(db: Session, venue: Venue) -> TodayCollections:
    """Money that actually came in today, by method — staff-visible (not a `/reports/*`
    business-total endpoint), since it's just a breakdown of payments staff already see
    on each of today's bookings, grouped for the till reconciliation at closing time."""
    tz = zoneinfo.ZoneInfo(venue.timezone)
    day_start = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    rows = (
        db.query(Payment)
        .join(Booking, Payment.booking_id == Booking.id)
        .filter(Booking.venue_id == venue.id, Payment.received_at >= day_start, Payment.received_at < day_end)
        .all()
    )

    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    counts: dict[str, int] = defaultdict(int)
    for p in rows:
        signed = p.amount if p.direction == PaymentDirection.payment else -p.amount
        totals[p.method.value] += signed
        counts[p.method.value] += 1

    total = sum(totals.values(), Decimal("0.00"))
    by_method = [
        CollectionsByMethod(method=m, amount=totals[m], count=counts[m]) for m in sorted(totals) if totals[m] != 0
    ]
    return TodayCollections(date=day_start.date().isoformat(), total=total, by_method=by_method)


def outstanding_report(db: Session, venue: Venue) -> OutstandingReport:
    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.payments))
        .filter(Booking.venue_id == venue.id, Booking.status.in_(["pending", "confirmed", "completed"]))
        .order_by(Booking.starts_at.asc())
        .all()
    )
    due = [b for b in bookings if payment_calc.due_amount(b) > 0]
    total = sum((payment_calc.due_amount(b) for b in due), Decimal("0.00"))
    return OutstandingReport(items=[to_booking_out(b) for b in due], total_outstanding=total)
