import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPk


class Field(UUIDPk, TimestampMixin, Base):
    __tablename__ = "fields"

    venue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("venues.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80))
    sport: Mapped[str] = mapped_column(String(40), default="football")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    venue: Mapped["Venue"] = relationship(back_populates="fields")
