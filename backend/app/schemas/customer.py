import uuid
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CustomerOut(ORMModel):
    id: uuid.UUID
    name: str
    phone: str
    team_name: str | None
    notes: str | None


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=32)
    team_name: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    team_name: str | None = None
    notes: str | None = None


class CustomerProfile(CustomerOut):
    total_bookings: int
    cancelled_bookings: int
    total_spent: Decimal
    outstanding: Decimal
    last_booking_at: str | None = None
