from datetime import time

from sqlalchemy import Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPk


class Venue(UUIDPk, TimestampMixin, Base):
    __tablename__ = "venues"

    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Dhaka")
    currency: Mapped[str] = mapped_column(String(8), default="BDT")
    address: Mapped[str | None] = mapped_column(String(255), default=None)
    maps_url: Mapped[str | None] = mapped_column(String(500), default=None)
    phone: Mapped[str | None] = mapped_column(String(32), default=None)

    opens_at: Mapped[time] = mapped_column(Time, default=time(6, 0))
    closes_at: Mapped[time] = mapped_column(Time, default=time(23, 0))
    slot_minutes: Mapped[int] = mapped_column(Integer, default=60)

    fields: Mapped[list["Field"]] = relationship(back_populates="venue", cascade="all, delete-orphan")
    users: Mapped[list["User"]] = relationship(back_populates="venue", cascade="all, delete-orphan")
