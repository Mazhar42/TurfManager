import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_current_venue
from app.core.errors import ApiError, NotFoundError
from app.db.session import get_db
from app.models.customer import Customer
from app.models.enums import BookingStatus
from app.models.user import User
from app.models.venue import Venue
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerProfile, CustomerUpdate
from app.services import payments as payment_calc

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> list[CustomerOut]:
    query = db.query(Customer).filter(Customer.venue_id == venue.id)
    if q:
        needle = f"%{q.strip()}%"
        query = query.filter((Customer.name.ilike(needle)) | (Customer.phone.ilike(needle)))
    return query.order_by(Customer.name.asc()).limit(200).all()


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> CustomerOut:
    existing = db.query(Customer).filter(Customer.venue_id == venue.id, Customer.phone == payload.phone).one_or_none()
    if existing:
        raise ApiError("DUPLICATE_PHONE", "A customer with this phone number already exists.", 409, {"customer_id": str(existing.id)})
    customer = Customer(venue_id=venue.id, **payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerProfile)
def get_customer(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> CustomerProfile:
    customer = db.query(Customer).options(joinedload(Customer.bookings)).filter(
        Customer.id == customer_id, Customer.venue_id == venue.id
    ).one_or_none()
    if not customer:
        raise NotFoundError("Customer")

    active = [b for b in customer.bookings if b.status != BookingStatus.cancelled]
    cancelled = [b for b in customer.bookings if b.status == BookingStatus.cancelled]
    total_spent = sum((payment_calc.paid_amount(b) for b in customer.bookings), Decimal("0.00"))
    outstanding = sum((payment_calc.due_amount(b) for b in active), Decimal("0.00"))
    last_booking = max((b.starts_at for b in customer.bookings), default=None)

    return CustomerProfile(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        team_name=customer.team_name,
        notes=customer.notes,
        total_bookings=len(active),
        cancelled_bookings=len(cancelled),
        total_spent=total_spent,
        outstanding=outstanding,
        last_booking_at=last_booking.isoformat() if last_booking else None,
    )


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> CustomerOut:
    customer = db.get(Customer, customer_id)
    if not customer or customer.venue_id != venue.id:
        raise NotFoundError("Customer")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer
