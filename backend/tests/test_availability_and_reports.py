from datetime import datetime, time


def test_availability_grid_reflects_booking(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]
    starts = datetime.combine(tomorrow, time(9, 0)).isoformat()
    ends = datetime.combine(tomorrow, time(10, 0)).isoformat()

    created = app_client.post(
        "/api/v1/bookings", headers=auth_headers,
        json={
            "field_id": str(field.id), "starts_at": starts, "ends_at": ends,
            "customer_name": "Grid FC", "customer_phone": "01755555555", "price_amount": "1400.00",
            "advance_amount": "400.00",
        },
    )
    assert created.status_code == 201, created.text

    grid = app_client.get(
        f"/api/v1/availability?field_id={field.id}&date={tomorrow.isoformat()}", headers=auth_headers
    )
    assert grid.status_code == 200, grid.text
    slots = grid.json()["slots"]

    nine_am = next(s for s in slots if s["starts_at"].startswith(f"{tomorrow.isoformat()}T09:00"))
    ten_am = next(s for s in slots if s["starts_at"].startswith(f"{tomorrow.isoformat()}T10:00"))

    assert nine_am["state"] == "booked"
    assert nine_am["booking"]["customer_name"] == "Grid FC"
    assert nine_am["booking"]["due_amount"] == "1000.00"
    assert ten_am["state"] in ("available", "past")


def test_daily_report_totals_match_bookings(app_client, auth_headers, seeded, tomorrow):
    field = seeded["field"]
    starts = datetime.combine(tomorrow, time(15, 0)).isoformat()
    ends = datetime.combine(tomorrow, time(16, 0)).isoformat()
    app_client.post(
        "/api/v1/bookings", headers=auth_headers,
        json={
            "field_id": str(field.id), "starts_at": starts, "ends_at": ends,
            "customer_name": "Report FC", "customer_phone": "01766666666", "price_amount": "2000.00",
            "advance_amount": "2000.00",
        },
    )

    report = app_client.get(f"/api/v1/reports/daily?date={tomorrow.isoformat()}", headers=auth_headers)
    assert report.status_code == 200, report.text
    body = report.json()
    assert body["bookings"] == 1
    assert body["gross_revenue"] == "2000.00"
    assert body["collected"] == "2000.00"
    assert body["outstanding"] == "0.00"
