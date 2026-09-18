import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class BlockedSlotOut(ORMModel):
    id: uuid.UUID
    field_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    reason: str | None


class BlockedSlotCreate(BaseModel):
    field_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    reason: str | None = None
