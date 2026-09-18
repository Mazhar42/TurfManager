import uuid
from datetime import datetime

from sqlalchemy import Computed, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import TSTZRANGE, UUID, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPk


class BlockedSlot(UUIDPk, TimestampMixin, Base):
    """Owner-declared downtime (maintenance, private use). Same overlap protection as
    bookings, and the two share the field via the raw SQL check in the booking service
    since a booking must not land inside a blocked slot either (see services/booking.py).
    """

    __tablename__ = "blocked_slots"
    __table_args__ = (
        ExcludeConstraint(
            ("field_id", "="),
            ("slot", "&&"),
            name="blocked_slots_no_overlap",
            using="gist",
        ),
    )

    venue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("venues.id", ondelete="CASCADE"))
    field_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fields.id", ondelete="CASCADE"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    slot = mapped_column(
        TSTZRANGE, Computed("tstzrange(starts_at, ends_at, '[)')", persisted=True)
    )
    reason: Mapped[str | None] = mapped_column(String(255), default=None)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), default=None)
