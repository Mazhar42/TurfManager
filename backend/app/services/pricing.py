"""Resolve the price for a field/time window from the venue's pricing rules.

Simple, deliberately: filter to rules matching the field (specific beats wildcard),
weekday, time window and validity dates; highest `priority` wins, then field-specific
beats wildcard. No dynamic pricing engine.
"""
import uuid
from datetime import datetime, time
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.pricing_rule import PricingRule


def _time_window_covers(rule_start: time, rule_end: time, booking_start: time, booking_end: time) -> bool:
    """True if [booking_start, booking_end) falls within [rule_start, rule_end)."""
    if rule_start <= rule_end:
        return rule_start <= booking_start and booking_end <= rule_end
    # Overnight window (e.g. 22:00-02:00) — not currently used by turf hours, but handled.
    return booking_start >= rule_start or booking_end <= rule_end


def resolve_price(
    db: Session, venue_id: uuid.UUID, field_id: uuid.UUID, starts_at: datetime, ends_at: datetime
) -> tuple[Decimal, PricingRule | None]:
    weekday = starts_at.weekday()  # 0=Mon .. 6=Sun, matches PricingRule.days
    booking_date = starts_at.date()
    start_t, end_t = starts_at.time(), ends_at.time()

    rules = (
        db.query(PricingRule)
        .filter(
            PricingRule.venue_id == venue_id,
            PricingRule.is_active.is_(True),
            (PricingRule.field_id == field_id) | (PricingRule.field_id.is_(None)),
        )
        .all()
    )

    candidates: list[PricingRule] = []
    for rule in rules:
        if weekday not in rule.days:
            continue
        if rule.valid_from and booking_date < rule.valid_from:
            continue
        if rule.valid_to and booking_date > rule.valid_to:
            continue
        if not _time_window_covers(rule.start_time, rule.end_time, start_t, end_t):
            continue
        candidates.append(rule)

    if not candidates:
        return Decimal("0.00"), None

    # Highest priority wins; ties broken by field-specific over wildcard.
    best = max(candidates, key=lambda r: (r.priority, r.field_id is not None))
    return best.price, best
