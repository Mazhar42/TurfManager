import os
import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from alembic import command

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://turf:turf@localhost:5433/turfmanager_test"
)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="session")
def db_url() -> str:
    return os.environ["DATABASE_URL"]


@pytest.fixture(scope="session", autouse=True)
def apply_migrations(db_url):
    """Run Alembic against a real Postgres test database once per test session.

    The exclusion-constraint behaviour under test only exists in PostgreSQL — this
    intentionally does not fall back to SQLite.
    """
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture()
def engine(db_url):
    eng = create_engine(db_url, future=True)
    yield eng
    eng.dispose()


@pytest.fixture(autouse=True)
def clean_tables(engine):
    """Truncate all app tables between tests so each test starts from a clean slate."""
    yield
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE booking_events, payments, bookings, blocked_slots, "
                "pricing_rules, customers, refresh_tokens, users, fields, venues CASCADE"
            )
        )


@pytest.fixture()
def db_session(engine):
    Session = sessionmaker(bind=engine, future=True)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def app_client(monkeypatch, db_url):
    monkeypatch.setenv("DATABASE_URL", db_url)
    from app.db import session as db_session_module

    # Recreate the engine against the test DB (module-level engine was built at import time).
    new_engine = create_engine(db_url, future=True)
    db_session_module.engine = new_engine
    db_session_module.SessionLocal.configure(bind=new_engine)

    from app.main import app

    return TestClient(app)


@pytest.fixture()
def seeded(db_session):
    """A venue with one field, an owner user, opening hours 06:00-23:00, 60-minute slots."""
    from app.core.security import hash_password
    from app.models.field import Field
    from app.models.user import User
    from app.models.venue import Venue

    venue = Venue(name="Test Turf", slug=f"test-turf-{uuid.uuid4().hex[:8]}", opens_at=time(6, 0), closes_at=time(23, 0), slot_minutes=60)
    db_session.add(venue)
    db_session.flush()

    field = Field(venue_id=venue.id, name="Field A", sport="football")
    db_session.add(field)

    owner = User(
        venue_id=venue.id, name="Owner", phone="01700000000",
        password_hash=hash_password("password123"), role="owner",
    )
    db_session.add(owner)
    db_session.commit()
    db_session.refresh(venue)
    db_session.refresh(field)
    db_session.refresh(owner)
    return {"venue": venue, "field": field, "owner": owner}


@pytest.fixture()
def auth_headers(app_client, seeded):
    resp = app_client.post("/api/v1/auth/login", json={"phone": "01700000000", "password": "password123"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def tomorrow() -> date:
    # Venue-local, not the machine's local date: CI runs in UTC, the venue in Asia/Dhaka.
    return datetime.now(ZoneInfo("Asia/Dhaka")).date() + timedelta(days=1)
