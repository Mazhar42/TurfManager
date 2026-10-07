"""Behaviour added while hardening for production: audit trail, rescheduling, venue-local
day boundaries, login throttling, startup config checks, and race handling under load."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

DHAKA = ZoneInfo("Asia/Dhaka")


def _local(iso: str) -> datetime:
    return datetime.fromisoformat(iso).astimezone(DHAKA)


def _book(app_client, headers, field_id, day, hour, name="Audit FC", phone="01755555555", **extra):
    return app_client.post(
        "/api/v1/bookings",
        headers=headers,
        json={
            "field_id": str(field_id),
            "starts_at": datetime.combine(day, time(hour, 0)).isoformat(),
            "ends_at": datetime.combine(day, time(hour + 1, 0)).isoformat(),
            "customer_name": name,
            "customer_phone": phone,
            "price_amount": "1500.00",
            **extra,
        },
    )


def test_health_checks_the_database(app_client):
    resp = app_client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "database": "ok"}
    assert resp.headers.get("X-Request-ID")


def test_booking_detail_carries_the_audit_trail(app_client, auth_headers, seeded, tomorrow):
    resp = _book(app_client, auth_headers, seeded["field"].id, tomorrow, 18, advance_amount="500.00", advance_method="bkash")
    assert resp.status_code == 201, resp.text
    booking_id = resp.json()["id"]

    resp = app_client.post(
        f"/api/v1/bookings/{booking_id}/status", headers=auth_headers, json={"status": "cancelled", "reason": "Rain"}
    )
    assert resp.status_code == 200, resp.text

    events = app_client.get(f"/api/v1/bookings/{booking_id}", headers=auth_headers).json()["events"]
    assert [e["event_type"] for e in events] == ["created", "payment_recorded", "status_changed"]
    assert all(e["actor_name"] == "Owner" for e in events)
    assert events[-1]["to_status"] == "cancelled"
    assert events[-1]["payload"] == {"reason": "Rain"}


def test_reschedule_moves_the_booking_and_is_audited(app_client, auth_headers, seeded, tomorrow):
    field_id = seeded["field"].id
    booking_id = _book(app_client, auth_headers, field_id, tomorrow, 18).json()["id"]

    resp = app_client.patch(
        f"/api/v1/bookings/{booking_id}",
        headers=auth_headers,
        json={
            "starts_at": datetime.combine(tomorrow, time(20, 0)).isoformat(),
            "ends_at": datetime.combine(tomorrow, time(21, 0)).isoformat(),
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert _local(body["starts_at"]) == datetime.combine(tomorrow, time(20, 0), tzinfo=DHAKA)
    event = body["events"][-1]
    assert event["event_type"] == "rescheduled"
    assert _local(event["payload"]["before"]["starts_at"]) == datetime.combine(tomorrow, time(18, 0), tzinfo=DHAKA)

    # The old slot is free again.
    assert _book(app_client, auth_headers, field_id, tomorrow, 18, name="Next FC", phone="01766666666").status_code == 201


def test_reschedule_into_a_taken_slot_or_outside_hours_is_rejected(app_client, auth_headers, seeded, tomorrow):
    field_id = seeded["field"].id
    first = _book(app_client, auth_headers, field_id, tomorrow, 18).json()["id"]
    _book(app_client, auth_headers, field_id, tomorrow, 19, name="Other FC", phone="01766666666")

    def move(hour: int):
        return app_client.patch(
            f"/api/v1/bookings/{first}",
            headers=auth_headers,
            json={
                "starts_at": datetime.combine(tomorrow, time(hour, 0)).isoformat(),
                "ends_at": datetime.combine(tomorrow, time(hour + 1, 0)).isoformat(),
            },
        )

    taken = move(19)
    assert taken.status_code == 409
    assert taken.json()["error"]["code"] == "SLOT_TAKEN"

    too_early = move(3)  # venue opens at 06:00
    assert too_early.status_code == 422
    assert too_early.json()["error"]["code"] == "OUTSIDE_OPENING_HOURS"


def test_opening_hours_are_checked_on_the_venue_clock_not_utc(app_client, auth_headers, seeded, tomorrow):
    """02:00Z is 08:00 in Dhaka — inside opening hours, even though 02:00 isn't."""
    resp = app_client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "field_id": str(seeded["field"].id),
            "starts_at": f"{tomorrow.isoformat()}T02:00:00Z",
            "ends_at": f"{tomorrow.isoformat()}T03:00:00Z",
            "customer_name": "Early FC",
            "customer_phone": "01777777777",
            "price_amount": "1200.00",
        },
    )
    assert resp.status_code == 201, resp.text


def test_booking_list_day_filter_uses_venue_midnight(app_client, auth_headers, seeded, db_session, tomorrow):
    """A 01:00 Dhaka booking is 19:00 UTC the previous day. It must still list under its
    own (venue-local) date, not the UTC one."""
    venue = seeded["venue"]
    venue.opens_at = time(0, 0)
    db_session.commit()

    resp = _book(app_client, auth_headers, seeded["field"].id, tomorrow, 1, name="Night FC", phone="01788888888")
    assert resp.status_code == 201, resp.text

    on_day = app_client.get(f"/api/v1/bookings?date={tomorrow.isoformat()}", headers=auth_headers).json()
    day_before = app_client.get(
        f"/api/v1/bookings?date={(tomorrow - timedelta(days=1)).isoformat()}", headers=auth_headers
    ).json()
    assert [b["customer"]["name"] for b in on_day] == ["Night FC"]
    assert day_before == []


def test_booking_search_matches_name_or_phone(app_client, auth_headers, seeded, tomorrow):
    field_id = seeded["field"].id
    _book(app_client, auth_headers, field_id, tomorrow, 10, name="Rahim FC", phone="01611111111")
    _book(app_client, auth_headers, field_id, tomorrow, 11, name="Karim XI", phone="01622222222")

    by_name = app_client.get("/api/v1/bookings?q=rahim", headers=auth_headers).json()
    by_phone = app_client.get("/api/v1/bookings?q=0162222", headers=auth_headers).json()
    assert [b["customer"]["name"] for b in by_name] == ["Rahim FC"]
    assert [b["customer"]["name"] for b in by_phone] == ["Karim XI"]


def test_repeated_failed_logins_are_throttled(app_client, seeded):
    from app.api.v1.auth import login_limiter

    login_limiter.reset("phone:01700000000", "ip:testclient")
    try:
        for _ in range(login_limiter.max_failures):
            bad = app_client.post("/api/v1/auth/login", json={"phone": "01700000000", "password": "wrong-password"})
            assert bad.status_code == 401
        blocked = app_client.post("/api/v1/auth/login", json={"phone": "01700000000", "password": "password123"})
        assert blocked.status_code == 429
        assert blocked.json()["error"]["code"] == "TOO_MANY_ATTEMPTS"
    finally:
        login_limiter.reset("phone:01700000000", "ip:testclient")

    ok = app_client.post("/api/v1/auth/login", json={"phone": "01700000000", "password": "password123"})
    assert ok.status_code == 200


def test_production_refuses_placeholder_secrets():
    from app.core.config import Settings

    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(environment="production", jwt_secret="change-me-to-a-long-random-string", cors_origins=["https://x.com"])
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings(environment="production", jwt_secret="x" * 48)

    ok = Settings(environment="production", jwt_secret="x" * 48, cors_origins=["https://turf.example.com"])
    assert ok.is_production


def test_many_simultaneous_bookings_never_500(app_client, auth_headers, seeded, tomorrow):
    """Under a real pile-up, Postgres may reject losers with a deadlock instead of an
    exclusion violation. Every loser must still get a clean 409, never a 500."""
    field_id = seeded["field"].id

    def attempt(i: int):
        return _book(app_client, auth_headers, field_id, tomorrow, 21, name=f"Team {i}", phone=f"0150000000{i}")

    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = sorted(r.status_code for r in pool.map(attempt, range(8)))

    assert statuses == [201] + [409] * 7, statuses
