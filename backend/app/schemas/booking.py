import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import BookingStatus, PaymentStatus
from app.schemas.common import ORMModel
from app.schemas.customer import CustomerOut
from app.schemas.payment import PaymentOut


class BookingCreate(BaseModel):
    field_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime

    # Either an existing customer_id, or enough to create one inline.
    customer_id: uuid.UUID | None = None
    customer_name: str | None = None
    customer_phone: str | None = None

    price_amount: Decimal | None = None  # None => auto-priced via pricing rules
    notes: str | None = None
    status: BookingStatus = BookingStatus.confirmed

    advance_amount: Decimal | None = Field(default=None, ge=0)
    advance_method: str | None = None

    @model_validator(mode="after")
    def check_customer(self) -> "BookingCreate":
        if not self.customer_id and not (self.customer_name and self.customer_phone):
            raise ValueError("Provide customer_id, or customer_name + customer_phone to create one.")
        return self


class BookingUpdate(BaseModel):
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    field_id: uuid.UUID | None = None
    price_amount: Decimal | None = None
    notes: str | None = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    reason: str | None = None


class BookingOut(ORMModel):
    id: uuid.UUID
    field_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    status: BookingStatus
    price_amount: Decimal
    notes: str | None
    customer: CustomerOut

    paid_amount: Decimal
    due_amount: Decimal
    payment_status: PaymentStatus


class BookingDetail(BookingOut):
    payments: list[PaymentOut]
