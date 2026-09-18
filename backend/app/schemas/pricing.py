import uuid
from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class PricingRuleOut(ORMModel):
    id: uuid.UUID
    field_id: uuid.UUID | None
    label: str
    days: list[int]
    start_time: time
    end_time: time
    price: Decimal
    priority: int
    is_active: bool
    valid_from: date | None
    valid_to: date | None


class PricingRuleCreate(BaseModel):
    field_id: uuid.UUID | None = None
    label: str
    days: list[int] = Field(min_length=1)
    start_time: time
    end_time: time
    price: Decimal = Field(gt=0)
    priority: int = 0
    valid_from: date | None = None
    valid_to: date | None = None

    @field_validator("days")
    @classmethod
    def validate_days(cls, v: list[int]) -> list[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("days must be 0 (Mon) through 6 (Sun)")
        return sorted(set(v))


class PricingRuleUpdate(BaseModel):
    label: str | None = None
    days: list[int] | None = None
    start_time: time | None = None
    end_time: time | None = None
    price: Decimal | None = Field(default=None, gt=0)
    priority: int | None = None
    is_active: bool | None = None
    valid_from: date | None = None
    valid_to: date | None = None


class PriceQuoteRequest(BaseModel):
    field_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime


class PriceQuoteResponse(BaseModel):
    price: Decimal
    rule_id: uuid.UUID | None
    rule_label: str | None
