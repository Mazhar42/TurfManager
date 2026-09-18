import uuid
from datetime import date, time
from decimal import Decimal

from sqlalchemy import ARRAY, Boolean, Date, ForeignKey, Integer, Numeric, SmallInteger, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPk


class PricingRule(UUIDPk, TimestampMixin, Base):
    """A rate for a day-of-week × time window. field_id NULL means 'all fields'.

    Resolution (see services/pricing.py): among rules matching the field, weekday, time
    window and validity dates, the highest `priority` wins; ties broken by field-specific
    beating wildcard.
    """

    __tablename__ = "pricing_rules"

    venue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("venues.id", ondelete="CASCADE"))
    field_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fields.id", ondelete="CASCADE"), default=None
    )
    label: Mapped[str] = mapped_column(String(80))
    days: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger))  # 0=Mon .. 6=Sun (ISO weekday - 1)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    valid_from: Mapped[date | None] = mapped_column(Date, default=None)
    valid_to: Mapped[date | None] = mapped_column(Date, default=None)
