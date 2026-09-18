"""Payment status is derived from the payments ledger, never stored on the booking —
one source of truth, so the two can never drift apart.
"""
from decimal import Decimal

from app.models.booking import Booking
from app.models.enums import PaymentDirection, PaymentStatus


def paid_amount(booking: Booking) -> Decimal:
    total = Decimal("0.00")
    for p in booking.payments:
        if p.direction == PaymentDirection.payment:
            total += p.amount
        else:
            total -= p.amount
    return total


def due_amount(booking: Booking) -> Decimal:
    due = booking.price_amount - paid_amount(booking)
    return due if due > 0 else Decimal("0.00")


def payment_status(booking: Booking) -> PaymentStatus:
    paid = paid_amount(booking)
    has_refund = any(p.direction == PaymentDirection.refund for p in booking.payments)
    if paid <= 0:
        return PaymentStatus.refunded if has_refund else PaymentStatus.unpaid
    if paid < booking.price_amount:
        return PaymentStatus.partial
    return PaymentStatus.paid


def net_refunded(booking: Booking) -> Decimal:
    return sum((p.amount for p in booking.payments if p.direction == PaymentDirection.refund), Decimal("0.00"))
