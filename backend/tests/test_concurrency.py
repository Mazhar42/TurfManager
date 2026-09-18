"""The test that matters: proving the database — not the application — is what prevents
two bookings from ever holding the same field at an overlapping time.
"""
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timezone

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker


def _dt(day, hour: int) -> datetime:
    return datetime.combine(day, time(hour, 0), tzinfo=timezone.utc)


def test_raw_exclusion_constraint_allows_only_one_of_two_overlapping_inserts(engine, seeded, tomorrow):
    """Two independent sessions race to insert the same field/time. Postgres's GiST
    exclusion constraint — not application code — must let exactly one through."""
    venue, field, owner = seeded["venue"], seeded["field"], seeded["owner"]
    Session = sessionmaker(bind=engine, future=True)

    with engine.begin() as conn:
        cid = conn.execute(
            text("INSERT INTO customers (venue_id, name, phone) VALUES (:v, 'Racer', '019') RETURNING id"),
            {"v": str(venue.id)},
        ).scalar()

    starts, ends = _dt(tomorrow, 20), _dt(tomorrow, 21)
    results: dict[int, str] = {}
    barrier = threading.Barrier(2)

    def attempt(idx: int) -> None:
        session = Session()
        try:
            session.execute(text("BEGIN"))
            barrier.wait(timeout=5)
            session.execute(
                text(
                    "INSERT INTO bookings (venue_id, field_id, customer_id, starts_at, ends_at, price_amount) "
                    "VALUES (:v, :f, :c, :s, :e, 1500)"
                ),
                {"v": str(venue.id), "f": str(field.id), "c": str(cid), "s": starts, "e": ends},
            )
            session.commit()
            results[idx] = "ok"
        except IntegrityError:
            session.rollback()
            results[idx] = "conflict"
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(attempt, [0, 1]))

    outcomes = sorted(results.values())
    assert outcomes == ["conflict", "ok"], f"expected exactly one winner, got {results}"

    with engine.begin() as conn:
        count = conn.execute(
            text("SELECT count(*) FROM bookings WHERE field_id = :f AND starts_at = :s"),
            {"f": str(field.id), "s": starts},
        ).scalar()
    assert count == 1


def test_concurrent_api_bookings_yield_one_201_and_one_409(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]
    starts = datetime.combine(tomorrow, time(18, 0)).isoformat()
    ends = datetime.combine(tomorrow, time(19, 0)).isoformat()

    def book(name: str):
        return app_client.post(
            "/api/v1/bookings",
            headers=auth_headers,
            json={
                "field_id": str(field.id), "starts_at": starts, "ends_at": ends,
                "customer_name": name, "customer_phone": f"017{hash(name) % 10_000_000:07d}",
                "price_amount": "1500.00",
            },
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(book, ["Rahim FC", "Karim FC"]))

    statuses = sorted(r.status_code for r in responses)
    assert statuses == [201, 409], [r.text for r in responses]
    conflict = next(r for r in responses if r.status_code == 409)
    assert conflict.json()["error"]["code"] == "SLOT_TAKEN"


def test_adjacent_slots_do_not_conflict(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]

    def book(hour: int):
        starts = datetime.combine(tomorrow, time(hour, 0)).isoformat()
        ends = datetime.combine(tomorrow, time(hour + 1, 0)).isoformat()
        return app_client.post(
            "/api/v1/bookings", headers=auth_headers,
            json={
                "field_id": str(field.id), "starts_at": starts, "ends_at": ends,
                "customer_name": "Adjacent", "customer_phone": "01711111111", "price_amount": "1200.00",
            },
        )

    first = book(8)
    second = book(9)  # ends of first == start of second; half-open ranges must not collide
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text


def test_cancelling_a_booking_frees_the_slot(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]
    starts = datetime.combine(tomorrow, time(14, 0)).isoformat()
    ends = datetime.combine(tomorrow, time(15, 0)).isoformat()
    payload = {
        "field_id": str(field.id), "starts_at": starts, "ends_at": ends,
        "customer_name": "First", "customer_phone": "01722222222", "price_amount": "1000.00",
    }

    created = app_client.post("/api/v1/bookings", headers=auth_headers, json=payload)
    assert created.status_code == 201
    booking_id = created.json()["id"]

    cancelled = app_client.post(
        f"/api/v1/bookings/{booking_id}/status", headers=auth_headers, json={"status": "cancelled", "reason": "test"}
    )
    assert cancelled.status_code == 200, cancelled.text

    payload["customer_name"] = "Second"
    payload["customer_phone"] = "01733333333"
    rebooked = app_client.post("/api/v1/bookings", headers=auth_headers, json=payload)
    assert rebooked.status_code == 201, rebooked.text


def test_idempotency_key_prevents_duplicate_bookings(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]
    starts = datetime.combine(tomorrow, time(16, 0)).isoformat()
    ends = datetime.combine(tomorrow, time(17, 0)).isoformat()
    payload = {
        "field_id": str(field.id), "starts_at": starts, "ends_at": ends,
        "customer_name": "Idempotent", "customer_phone": "01744444444", "price_amount": "1300.00",
    }
    headers = {**auth_headers, "Idempotency-Key": "retry-key-123"}

    first = app_client.post("/api/v1/bookings", headers=headers, json=payload)
    second = app_client.post("/api/v1/bookings", headers=headers, json=payload)

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]
