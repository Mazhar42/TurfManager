from fastapi import APIRouter

from app.api.v1 import auth, availability, blocked_slots, bookings, customers, pricing, reports, settings, staff

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(availability.router)
api_router.include_router(bookings.router)
api_router.include_router(customers.router)
api_router.include_router(pricing.router)
api_router.include_router(reports.router)
api_router.include_router(blocked_slots.router)
api_router.include_router(settings.router)
api_router.include_router(staff.router)
