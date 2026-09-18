from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_venue, require_owner
from app.db.session import get_db
from app.models.user import User
from app.models.venue import Venue
from app.schemas.reports import DailyReport, MonthlyReport, OutstandingReport, TodayCollections
from app.services.reports import daily_report, monthly_report, outstanding_report, today_collections

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily", response_model=DailyReport)
def get_daily_report(
    day: date = Query(alias="date"),
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> DailyReport:
    return daily_report(db, venue, day)


@router.get("/monthly", response_model=MonthlyReport)
def get_monthly_report(
    month: str = Query(description="YYYY-MM"),
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> MonthlyReport:
    year_s, month_s = month.split("-")
    return monthly_report(db, venue, int(year_s), int(month_s))


@router.get("/today-collections", response_model=TodayCollections)
def get_today_collections(
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(get_current_user),
) -> TodayCollections:
    """Staff-accessible: just a by-method breakdown of payments staff already see."""
    return today_collections(db, venue)


@router.get("/outstanding", response_model=OutstandingReport)
def get_outstanding_report(
    db: Session = Depends(get_db),
    venue: Venue = Depends(get_current_venue),
    _user: User = Depends(require_owner),
) -> OutstandingReport:
    return outstanding_report(db, venue)
