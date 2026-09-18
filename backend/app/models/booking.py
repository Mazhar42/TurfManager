import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Computed, DateTime, Enum, ForeignKey, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import TSTZRANGE, UUID, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPk
from app.models.enums import BookingSource, BookingStatus

# Statuses that occupy the slot and therefore must not overlap another such booking.
_ACTIVE_STATUS_SQL = "('{}')".format("','".join(s.value for s in (
    BookingStatus.pending, BookingStatus.confirmed, BookingStatus.completed
)))


class Booking(UUIDPk, TimestampMixin, Base):
    """The core record. `slot` is a DB-generated range column; `bookings_no_overlap`
    is a GiST exclusion constraint that makes two active bookings on the same field
    with overlapping time ranges impossible to insert — not merely unlikely.
    """

    __tablename__ = "bookings"
    __table_args__ = (
        ExcludeConstraint(
            ("field_id", "="),
            ("slot", "&&"),
            name="bookings_no_overlap",
            where=text(f"status IN {_ACTIVE_STATUS_SQL}"),
            using="gist",
        ),
    )

    venue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("venues.id", ondelete="CASCADE"))
    field_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fields.id", ondelete="CASCADE"))
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"))

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    slot = mapped_column(
        TSTZRANGE, Computed("tstzrange(starts_at, ends_at, '[)')", persisted=True)
    )

    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status", native_enum=True), default=BookingStatus.confirmed
    )
    source: Mapped[BookingSource] = mapped_column(
        Enum(BookingSource, name="booking_source", native_enum=True), default=BookingSource.staff
    )

    price_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), default=None)
    idempotency_key: Mapped[str | None] = mapped_column(String(64), unique=True, default=None)

    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    cancel_reason: Mapped[str | None] = mapped_column(String(255), default=None)

    customer: Mapped["Customer"] = relationship(back_populates="bookings")
    payments: Mapped[list["Payment"]] = relationship(back_populates="booking", cascade="all, delete-orphan")
    events: Mapped[list["BookingEvent"]] = relationship(back_populates="booking", cascade="all, delete-orphan")
