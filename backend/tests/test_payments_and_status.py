from datetime import datetime, time


def _booking_payload(field_id, day, hour, price="1800.00", **overrides):
    payload = {
        "field_id": str(field_id),
        "starts_at": datetime.combine(day, time(hour, 0)).isoformat(),
        "ends_at": datetime.combine(day, time(hour + 1, 0)).isoformat(),
        "customer_name": "Payer FC",
        "customer_phone": "01799999999",
        "price_amount": price,
    }
    payload.update(overrides)
    return payload


def test_advance_then_balance_payment_updates_derived_status(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]
    payload = _booking_payload(field.id, tomorrow, 10, advance_amount="500.00")
    created = app_client.post("/api/v1/bookings", headers=auth_headers, json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["payment_status"] == "partial"
    assert body["paid_amount"] == "500.00"
    assert body["due_amount"] == "1300.00"

    booking_id = body["id"]
    balance = app_client.post(
        f"/api/v1/bookings/{booking_id}/payments", headers=auth_headers,
        json={"amount": "1300.00", "method": "cash"},
    )
    assert balance.status_code == 200, balance.text
    assert balance.json()["payment_status"] == "paid"
    assert balance.json()["due_amount"] == "0.00"


def test_overpayment_is_rejected(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]
    payload = _booking_payload(field.id, tomorrow, 11)
    created = app_client.post("/api/v1/bookings", headers=auth_headers, json=payload)
    booking_id = created.json()["id"]

    resp = app_client.post(
        f"/api/v1/bookings/{booking_id}/payments", headers=auth_headers,
        json={"amount": "5000.00", "method": "cash"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "OVERPAYMENT"


def test_illegal_status_transition_is_rejected(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]
    payload = _booking_payload(field.id, tomorrow, 12)
    created = app_client.post("/api/v1/bookings", headers=auth_headers, json=payload)
    booking_id = created.json()["id"]
    assert created.json()["status"] == "confirmed"

    # confirmed -> pending is not a legal transition (see BOOKING_STATUS_TRANSITIONS)
    resp = app_client.post(f"/api/v1/bookings/{booking_id}/status", headers=auth_headers, json={"status": "pending"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

    # confirmed -> completed is legal
    ok = app_client.post(f"/api/v1/bookings/{booking_id}/status", headers=auth_headers, json={"status": "completed"})
    assert ok.status_code == 200

    # completed is terminal: no further transitions
    dead_end = app_client.post(f"/api/v1/bookings/{booking_id}/status", headers=auth_headers, json={"status": "cancelled"})
    assert dead_end.status_code == 422


def test_staff_cannot_access_owner_only_endpoints(app_client, auth_headers, seeded, db_session, tomorrow):
    from app.core.security import hash_password
    from app.models.user import User

    venue = seeded["venue"]
    staff = User(venue_id=venue.id, name="Staff", phone="01788888888", password_hash=hash_password("password123"), role="staff")
    db_session.add(staff)
    db_session.commit()

    login = app_client.post("/api/v1/auth/login", json={"phone": "01788888888", "password": "password123"})
    assert login.status_code == 200
    staff_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    for method, path in [
        ("GET", "/api/v1/reports/daily?date=2026-01-01"),
        ("GET", "/api/v1/pricing-rules"),
        ("GET", "/api/v1/staff"),
        ("PATCH", "/api/v1/settings/venue"),
    ]:
        resp = app_client.request(method, path, headers=staff_headers, json={} if method == "PATCH" else None)
        assert resp.status_code == 403, f"{method} {path} should be forbidden for staff, got {resp.status_code}"
        assert resp.json()["error"]["code"] == "FORBIDDEN"

    # Staff CAN use the core booking flow.
    field = seeded["field"]
    resp = app_client.post(
        "/api/v1/bookings", headers=staff_headers,
        json=_booking_payload(field.id, tomorrow, 13),
    )
    assert resp.status_code == 201, resp.text
