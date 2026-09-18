import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import PaymentDirection, PaymentMethod
from app.schemas.common import ORMModel


class PaymentOut(ORMModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    amount: Decimal
    method: PaymentMethod
    direction: PaymentDirection
    reference: str | None
    received_at: datetime
    note: str | None


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    method: PaymentMethod
    direction: PaymentDirection = PaymentDirection.payment
    reference: str | None = None
    note: str | None = None
