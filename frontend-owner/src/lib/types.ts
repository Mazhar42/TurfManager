export type UserRole = "owner" | "staff";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export interface Venue {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  address: string | null;
  phone: string | null;
  opens_at: string;
  closes_at: string;
  slot_minutes: number;
}

export interface CurrentUser {
  id: string;
  venue_id: string;
  name: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  team_name: string | null;
}

export interface Booking {
  id: string;
  field_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price_amount: string;
  notes: string | null;
  customer: Customer;
  paid_amount: string;
  due_amount: string;
  payment_status: PaymentStatus;
}

export interface DailyReport {
  date: string;
  bookings: number;
  gross_revenue: string;
  collected: string;
  outstanding: string;
  cancelled: number;
  available_slots: number;
}

export interface RevenueByDay {
  date: string;
  revenue: string;
  bookings: number;
}

export interface BookingsByHour {
  hour: number;
  bookings: number;
}

export interface TopCustomer {
  customer_id: string;
  name: string;
  bookings: number;
  total_spent: string;
}

export interface MonthlyReport {
  month: string;
  total_bookings: number;
  booked_hours: string;
  gross_revenue: string;
  collected: string;
  outstanding: string;
  cancelled_bookings: number;
  revenue_by_day: RevenueByDay[];
  bookings_by_hour: BookingsByHour[];
  top_customers: TopCustomer[];
}

export interface OutstandingReport {
  items: Booking[];
  total_outstanding: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}
