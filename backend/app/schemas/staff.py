import uuid

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class StaffOut(ORMModel):
    id: uuid.UUID
    name: str
    phone: str
    role: UserRole
    is_active: bool


class StaffCreate(BaseModel):
    name: str
    phone: str = Field(min_length=6, max_length=32)
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = UserRole.staff


class StaffUpdate(BaseModel):
    name: str | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None
