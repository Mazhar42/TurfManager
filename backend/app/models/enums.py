import enum


class UserRole(str, enum.Enum):
    owner = "owner"
    staff = "staff"


class BookingStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


# Statuses that still occupy the slot and therefore participate in the overlap constraint.
ACTIVE_BOOKING_STATUSES = (BookingStatus.pending, BookingStatus.confirmed, BookingStatus.completed)

# Legal status transitions, enforced in the booking service.
BOOKING_STATUS_TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    BookingStatus.pending: {BookingStatus.confirmed, BookingStatus.cancelled},
    BookingStatus.confirmed: {BookingStatus.completed, BookingStatus.cancelled, BookingStatus.no_show},
    BookingStatus.completed: set(),
    BookingStatus.cancelled: set(),
    BookingStatus.no_show: set(),
}


class BookingSource(str, enum.Enum):
    staff = "staff"
    online = "online"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    bkash = "bkash"
    nagad = "nagad"
    card = "card"
    bank = "bank"


class PaymentDirection(str, enum.Enum):
    payment = "payment"
    refund = "refund"


class PaymentStatus(str, enum.Enum):
    """Derived, never stored — see services/payments.py."""

    unpaid = "unpaid"
    partial = "partial"
    paid = "paid"
    refunded = "refunded"
