"""Seed a demo venue so the PWA has something real to show.

Run with:  uv run python -m scripts.seed
"""
import zoneinfo
from datetime import date, datetime, time, timedelta

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.customer import Customer
from app.models.enums import BookingStatus, PaymentDirection, PaymentMethod
from app.models.field import Field
from app.models.payment import Payment
from app.models.pricing_rule import PricingRule
from app.models.user import User
from app.models.venue import Venue

WEEKDAYS = [0, 1, 2, 3, 4]  # Mon-Fri
FRIDAY = [4]


def run() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Venue).filter(Venue.slug == "his-turf").one_or_none()
        if existing:
            print(f"Demo venue already exists: {existing.id}")
            return

        venue = Venue(
            name="His Turf Football Arena",
            slug="his-turf",
            timezone="Asia/Dhaka",
            currency="BDT",
            address="Gulshan, Dhaka",
            phone="01700000000",
            opens_at=time(6, 0),
            closes_at=time(23, 0),
            slot_minutes=60,
        )
        db.add(venue)
        db.flush()

        field_a = Field(venue_id=venue.id, name="Field A", sport="football", sort_order=0)
        field_b = Field(venue_id=venue.id, name="Field B (5-a-side)", sport="football", sort_order=1)
        db.add_all([field_a, field_b])
        db.flush()

        owner = User(
            venue_id=venue.id, name="Owner", phone="01700000000",
            password_hash=hash_password("owner12345"), role="owner",
        )
        staff = User(
            venue_id=venue.id, name="Staff", phone="01711111111",
            password_hash=hash_password("staff12345"), role="staff",
        )
        db.add_all([owner, staff])
        db.flush()

        db.add_all([
            PricingRule(venue_id=venue.id, label="Weekday morning", days=WEEKDAYS, start_time=time(6, 0), end_time=time(17, 0), price="1200.00", priority=0),
            PricingRule(venue_id=venue.id, label="Weekday evening", days=WEEKDAYS, start_time=time(17, 0), end_time=time(23, 0), price="1800.00", priority=0),
            PricingRule(venue_id=venue.id, label="Friday morning", days=FRIDAY, start_time=time(6, 0), end_time=time(17, 0), price="1500.00", priority=1),
            PricingRule(venue_id=venue.id, label="Friday evening", days=FRIDAY, start_time=time(17, 0), end_time=time(23, 0), price="2000.00", priority=1),
        ])

        customers = [
            Customer(venue_id=venue.id, name="Rahim Ahmed", phone="01611111111", team_name="Rahim FC"),
            Customer(venue_id=venue.id, name="Karim Uddin", phone="01622222222", team_name="Friends XI"),
            Customer(venue_id=venue.id, name="Nayeem Hasan", phone="01633333333", team_name="Tigers FC"),
            Customer(venue_id=venue.id, name="ABC Corp", phone="01644444444", team_name="ABC Corp"),
        ]
        db.add_all(customers)
        db.flush()

        tz = zoneinfo.ZoneInfo(venue.timezone)
        today = datetime.now(tz).date()

        def make_booking(day: date, hour: int, customer: Customer, price: str, paid: str, status=BookingStatus.confirmed):
            starts = datetime.combine(day, time(hour, 0), tzinfo=tz)
            ends = datetime.combine(day, time(hour + 1, 0), tzinfo=tz)
            booking = Booking(
                venue_id=venue.id, field_id=field_a.id, customer_id=customer.id,
                starts_at=starts, ends_at=ends, status=status, price_amount=price, created_by=owner.id,
            )
            db.add(booking)
            db.flush()
            if paid and float(paid) > 0:
                db.add(Payment(booking_id=booking.id, amount=paid, method=PaymentMethod.bkash, direction=PaymentDirection.payment, received_by=owner.id))
            return booking

        # Today's bookings — this is what the Today screen shows on first login.
        make_booking(today, 7, customers[0], "1500.00", "1500.00")
        make_booking(today, 8, customers[1], "1500.00", "1500.00")
        make_booking(today, 19, customers[3], "2000.00", "1000.00")
        make_booking(today, 20, customers[2], "2000.00", "0.00")

        # A little history so Customers and Reports aren't empty.
        for i in range(1, 15):
            make_booking(today - timedelta(days=i), 18, customers[i % 4], "1800.00", "1800.00")

        db.commit()
        print(f"Seeded venue '{venue.name}' ({venue.id})")
        print("Login as owner: 01700000000 / owner12345")
        print("Login as staff: 01711111111 / staff12345")
    finally:
        db.close()


if __name__ == "__main__":
    run()
