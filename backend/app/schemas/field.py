import uuid

from pydantic import BaseModel

from app.schemas.common import ORMModel


class FieldOut(ORMModel):
    id: uuid.UUID
    venue_id: uuid.UUID
    name: str
    sport: str
    is_active: bool
    sort_order: int


class FieldCreate(BaseModel):
    name: str
    sport: str = "football"
    sort_order: int = 0


class FieldUpdate(BaseModel):
    name: str | None = None
    sport: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
