export type UserRole = "owner" | "staff";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export type PaymentMethod = "cash" | "bkash" | "nagad" | "card" | "bank";
export type PaymentDirection = "payment" | "refund";
export type SlotState = "available" | "booked" | "blocked" | "past";

export interface Venue {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  address: string | null;
  maps_url: string | null;
  phone: string | null;
  opens_at: string;
  closes_at: string;
  slot_minutes: number;
}

export interface Field {
  id: string;
  venue_id: string;
  name: string;
  sport: string;
  is_active: boolean;
  sort_order: number;
}

export interface CurrentUser {
  id: string;
  venue_id: string;
  name: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
}

export interface Staff {
  id: string;
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
  notes: string | null;
}

export interface CustomerProfile extends Customer {
  total_bookings: number;
  cancelled_bookings: number;
  total_spent: string;
  outstanding: string;
  last_booking_at: string | null;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: string;
  method: PaymentMethod;
  direction: PaymentDirection;
  reference: string | null;
  received_at: string;
  note: string | null;
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

export type BookingEventType =
  | "created"
  | "status_changed"
  | "rescheduled"
  | "repriced"
  | "payment_recorded"
  | "payment_deleted";

export interface BookingEvent {
  id: string;
  event_type: BookingEventType;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown>;
  actor_name: string | null;
  created_at: string;
}

export interface BookingDetail extends Booking {
  payments: Payment[];
  events: BookingEvent[];
}

export interface SlotBookingSummary {
  booking_id: string;
  customer_name: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  paid_amount: string;
  due_amount: string;
}

export interface Slot {
  starts_at: string;
  ends_at: string;
  state: SlotState;
  price: string;
  booking: SlotBookingSummary | null;
  blocked_reason: string | null;
}

export interface DayAvailability {
  field_id: string;
  date: string;
  slots: Slot[];
}

export interface PricingRule {
  id: string;
  field_id: string | null;
  label: string;
  days: number[];
  start_time: string;
  end_time: string;
  price: string;
  priority: number;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
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

export interface CollectionsByMethod {
  method: PaymentMethod;
  amount: string;
  count: number;
}

export interface TodayCollections {
  date: string;
  total: string;
  by_method: CollectionsByMethod[];
}

export interface BlockedSlot {
  id: string;
  field_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
