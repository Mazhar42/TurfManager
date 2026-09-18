import uuid
from datetime import time

from pydantic import BaseModel

from app.schemas.common import ORMModel


class VenueOut(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    timezone: str
    currency: str
    address: str | None
    maps_url: str | None
    phone: str | None
    opens_at: time
    closes_at: time
    slot_minutes: int


class VenueUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    maps_url: str | None = None
    phone: str | None = None
    opens_at: time | None = None
    closes_at: time | None = None
    slot_minutes: int | None = None
