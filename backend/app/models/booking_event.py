import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPk


class BookingEvent(UUIDPk, Base):
    """Audit trail: who did what to a booking, and when. Answers 'who cancelled this?'."""

    __tablename__ = "booking_events"

    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), default=None)
    event_type: Mapped[str] = mapped_column(String(40))  # created | status_changed | rescheduled | payment_recorded
    from_status: Mapped[str | None] = mapped_column(String(20), default=None)
    to_status: Mapped[str | None] = mapped_column(String(20), default=None)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    booking: Mapped["Booking"] = relationship(back_populates="events")
    actor: Mapped["User | None"] = relationship(lazy="joined", viewonly=True)
