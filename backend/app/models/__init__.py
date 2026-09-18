"""Import every model so Base.metadata is complete for Alembic autogenerate."""
from app.models.blocked_slot import BlockedSlot
from app.models.booking import Booking
from app.models.booking_event import BookingEvent
from app.models.customer import Customer
from app.models.field import Field
from app.models.payment import Payment
from app.models.pricing_rule import PricingRule
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.venue import Venue

__all__ = [
    "BlockedSlot",
    "Booking",
    "BookingEvent",
    "Customer",
    "Field",
    "Payment",
    "PricingRule",
    "RefreshToken",
    "User",
    "Venue",
]
