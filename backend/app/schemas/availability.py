import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

SlotState = Literal["available", "booked", "blocked", "past"]


class SlotBookingSummary(BaseModel):
    booking_id: uuid.UUID
    customer_name: str
    status: str
    payment_status: str
    paid_amount: Decimal
    due_amount: Decimal


class Slot(BaseModel):
    starts_at: datetime
    ends_at: datetime
    state: SlotState
    price: Decimal
    booking: SlotBookingSummary | None = None
    blocked_reason: str | None = None


class DayAvailability(BaseModel):
    field_id: uuid.UUID
    date: str
    slots: list[Slot]
