from decimal import Decimal

from pydantic import BaseModel

from app.schemas.booking import BookingOut


class DailyReport(BaseModel):
    date: str
    bookings: int
    gross_revenue: Decimal
    collected: Decimal
    outstanding: Decimal
    cancelled: int
    available_slots: int


class RevenueByDay(BaseModel):
    date: str
    revenue: Decimal
    bookings: int


class BookingsByHour(BaseModel):
    hour: int
    bookings: int


class TopCustomer(BaseModel):
    customer_id: str
    name: str
    bookings: int
    total_spent: Decimal


class MonthlyReport(BaseModel):
    month: str
    total_bookings: int
    booked_hours: Decimal
    gross_revenue: Decimal
    collected: Decimal
    outstanding: Decimal
    cancelled_bookings: int
    revenue_by_day: list[RevenueByDay]
    bookings_by_hour: list[BookingsByHour]
    top_customers: list[TopCustomer]


class OutstandingReport(BaseModel):
    items: list[BookingOut]
    total_outstanding: Decimal


class CollectionsByMethod(BaseModel):
    method: str
    amount: Decimal
    count: int


class TodayCollections(BaseModel):
    date: str
    total: Decimal
    by_method: list[CollectionsByMethod]
