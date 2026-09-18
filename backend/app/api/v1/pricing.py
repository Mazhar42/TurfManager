import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_venue, require_owner
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.pricing_rule import PricingRule
from app.models.user import User
from app.models.venue import Venue
from app.schemas.pricing import (
    PriceQuoteRequest,
    PriceQuoteResponse,
    PricingRuleCreate,
    PricingRuleOut,
    PricingRuleUpdate,
)
from app.services.booking import localize
from app.services.pricing import resolve_price

router = APIRouter(tags=["pricing"])


@router.get("/pricing-rules", response_model=list[PricingRuleOut])
def list_pricing_rules(
    db: Session = Depends(get_db), venue: Venue = Depends(get_current_venue), _user: User = Depends(require_owner)
) -> list[PricingRuleOut]:
    return (
        db.query(PricingRule)
        .filter(PricingRule.venue_id == venue.id)
        .order_by(PricingRule.priority.desc())
        .all()
    )


@router.post("/pricing-rules", response_model=PricingRuleOut, status_code=201)
def create_pricing_rule(
    payload: PricingRuleCreate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> PricingRuleOut:
    rule = PricingRule(venue_id=venue.id, **payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/pricing-rules/{rule_id}", response_model=PricingRuleOut)
def update_pricing_rule(
    rule_id: uuid.UUID,
    payload: PricingRuleUpdate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> PricingRuleOut:
    rule = db.get(PricingRule, rule_id)
    if not rule or rule.venue_id != venue.id:
        raise NotFoundError("Pricing rule")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/pricing-rules/{rule_id}", status_code=204)
def delete_pricing_rule(
    rule_id: uuid.UUID,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> None:
    rule = db.get(PricingRule, rule_id)
    if not rule or rule.venue_id != venue.id:
        raise NotFoundError("Pricing rule")
    db.delete(rule)
    db.commit()


@router.post("/pricing/quote", response_model=PriceQuoteResponse)
def quote_price(
    payload: PriceQuoteRequest,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> PriceQuoteResponse:
    starts_at = localize(venue, payload.starts_at)
    ends_at = localize(venue, payload.ends_at)
    price, rule = resolve_price(db, venue.id, payload.field_id, starts_at, ends_at)
    return PriceQuoteResponse(price=price, rule_id=rule.id if rule else None, rule_label=rule.label if rule else None)
