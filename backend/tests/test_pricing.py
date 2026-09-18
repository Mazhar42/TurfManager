from datetime import date, datetime, time, timezone

from app.models.pricing_rule import PricingRule
from app.services.pricing import resolve_price


def _dt(day, hour: int) -> datetime:
    return datetime.combine(day, time(hour, 0), tzinfo=timezone.utc)


def test_weekday_vs_evening_rule_priority(db_session, seeded, tomorrow):
    venue, field = seeded["venue"], seeded["field"]
    weekday = tomorrow.weekday()

    db_session.add_all([
        PricingRule(
            venue_id=venue.id, label="Day rate", days=[weekday],
            start_time=time(6, 0), end_time=time(17, 0), price="1200.00", priority=0,
        ),
        PricingRule(
            venue_id=venue.id, label="Evening rate", days=[weekday],
            start_time=time(17, 0), end_time=time(23, 0), price="1800.00", priority=0,
        ),
    ])
    db_session.commit()

    day_price, day_rule = resolve_price(db_session, venue.id, field.id, _dt(tomorrow, 10), _dt(tomorrow, 11))
    evening_price, evening_rule = resolve_price(db_session, venue.id, field.id, _dt(tomorrow, 19), _dt(tomorrow, 20))

    assert day_price == 1200 and day_rule.label == "Day rate"
    assert evening_price == 1800 and evening_rule.label == "Evening rate"


def test_field_specific_rule_beats_wildcard_at_equal_priority(db_session, seeded, tomorrow):
    venue, field = seeded["venue"], seeded["field"]
    weekday = tomorrow.weekday()

    db_session.add_all([
        PricingRule(
            venue_id=venue.id, field_id=None, label="All fields", days=[weekday],
            start_time=time(6, 0), end_time=time(23, 0), price="1200.00", priority=0,
        ),
        PricingRule(
            venue_id=venue.id, field_id=field.id, label="Field A special", days=[weekday],
            start_time=time(6, 0), end_time=time(23, 0), price="1500.00", priority=0,
        ),
    ])
    db_session.commit()

    price, rule = resolve_price(db_session, venue.id, field.id, _dt(tomorrow, 10), _dt(tomorrow, 11))
    assert price == 1500 and rule.label == "Field A special"


def test_higher_priority_overrides_more_specific_time_window(db_session, seeded, tomorrow):
    venue, field = seeded["venue"], seeded["field"]
    weekday = tomorrow.weekday()

    db_session.add_all([
        PricingRule(
            venue_id=venue.id, label="Base", days=[weekday],
            start_time=time(6, 0), end_time=time(23, 0), price="1200.00", priority=0,
        ),
        PricingRule(
            venue_id=venue.id, label="Holiday override", days=[weekday],
            start_time=time(6, 0), end_time=time(23, 0), price="2000.00", priority=10,
            valid_from=tomorrow, valid_to=tomorrow,
        ),
    ])
    db_session.commit()

    price, rule = resolve_price(db_session, venue.id, field.id, _dt(tomorrow, 10), _dt(tomorrow, 11))
    assert price == 2000 and rule.label == "Holiday override"


def test_no_matching_rule_returns_zero(db_session, seeded, tomorrow):
    venue, field = seeded["venue"], seeded["field"]
    price, rule = resolve_price(db_session, venue.id, field.id, _dt(tomorrow, 10), _dt(tomorrow, 11))
    assert price == 0 and rule is None


def test_rule_outside_validity_window_is_ignored(db_session, seeded, tomorrow):
    venue, field = seeded["venue"], seeded["field"]
    weekday = tomorrow.weekday()
    past = date(2020, 1, 1)

    db_session.add(
        PricingRule(
            venue_id=venue.id, label="Expired", days=[weekday],
            start_time=time(6, 0), end_time=time(23, 0), price="999.00", priority=5,
            valid_from=past, valid_to=past,
        )
    )
    db_session.commit()

    price, rule = resolve_price(db_session, venue.id, field.id, _dt(tomorrow, 10), _dt(tomorrow, 11))
    assert rule is None and price == 0
