import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type {
  BlockedSlot,
  Booking,
  BookingDetail,
  BookingStatus,
  Customer,
  CustomerProfile,
  DailyReport,
  DayAvailability,
  Field,
  MonthlyReport,
  OutstandingReport,
  PaymentDirection,
  PaymentMethod,
  PricingRule,
  Staff,
  TodayCollections,
  Venue,
} from "@/lib/types";

// --- Reads --------------------------------------------------------------------------

export function useFields() {
  return useQuery({ queryKey: queryKeys.fields(), queryFn: () => api.get<Field[]>("/fields") });
}

export function useAvailability(fieldId: string | undefined, date: string) {
  return useQuery({
    queryKey: queryKeys.availability(fieldId ?? "", date),
    queryFn: () => api.get<DayAvailability>(`/availability?field_id=${fieldId}&date=${date}`),
    enabled: !!fieldId,
    refetchInterval: 30_000,
  });
}

export interface BookingFilters {
  date?: string;
  from?: string;
  to?: string;
  status?: BookingStatus;
  q?: string;
  field_id?: string;
  customer_id?: string;
}

function toQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useBookingsList(filters: BookingFilters) {
  return useQuery({
    queryKey: queryKeys.bookings(filters),
    queryFn: () => api.get<Booking[]>(`/bookings${toQueryString(filters)}`),
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.booking(id ?? ""),
    queryFn: () => api.get<BookingDetail>(`/bookings/${id}`),
    enabled: !!id,
  });
}

export function useCustomers(q: string) {
  return useQuery({
    queryKey: queryKeys.customers(q),
    queryFn: () => api.get<Customer[]>(`/customers${toQueryString({ q })}`),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customer(id ?? ""),
    queryFn: () => api.get<CustomerProfile>(`/customers/${id}`),
    enabled: !!id,
  });
}

export function usePricingRules() {
  return useQuery({ queryKey: queryKeys.pricingRules(), queryFn: () => api.get<PricingRule[]>("/pricing-rules") });
}

export function useStaffList() {
  return useQuery({ queryKey: queryKeys.staff(), queryFn: () => api.get<Staff[]>("/staff") });
}

export function useDailyReport(date: string) {
  return useQuery({ queryKey: queryKeys.dailyReport(date), queryFn: () => api.get<DailyReport>(`/reports/daily?date=${date}`) });
}

export function useMonthlyReport(month: string) {
  return useQuery({ queryKey: queryKeys.monthlyReport(month), queryFn: () => api.get<MonthlyReport>(`/reports/monthly?month=${month}`) });
}

export function useOutstandingReport() {
  return useQuery({ queryKey: queryKeys.outstanding(), queryFn: () => api.get<OutstandingReport>("/reports/outstanding") });
}

export function useTodayCollections() {
  return useQuery({
    queryKey: queryKeys.todayCollections(),
    queryFn: () => api.get<TodayCollections>("/reports/today-collections"),
  });
}

export function useBlockedSlots() {
  return useQuery({ queryKey: queryKeys.blockedSlots(), queryFn: () => api.get<BlockedSlot[]>("/blocked-slots") });
}

// --- Writes ---------------------------------------------------------------------------

export interface CreateBookingInput {
  field_id: string;
  starts_at: string;
  ends_at: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  price_amount?: string;
  notes?: string;
  status?: BookingStatus;
  advance_amount?: string;
  advance_method?: PaymentMethod;
}

function genIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) =>
      api.post<BookingDetail>("/bookings", input, { idempotencyKey: genIdempotencyKey() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: BookingStatus; reason?: string }) =>
      api.post<BookingDetail>(`/bookings/${id}/status`, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking"] });
      qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export interface UpdateBookingInput {
  starts_at?: string;
  ends_at?: string;
  field_id?: string;
  price_amount?: string;
  notes?: string;
}

/** Reschedule (time/field) and/or reprice a booking. The server re-checks the slot against
 * the exclusion constraint and blocked slots, and records the change in the audit trail. */
export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBookingInput & { id: string }) => api.patch<BookingDetail>(`/bookings/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking"] });
      qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookingId,
      amount,
      method,
      direction,
      reference,
      note,
    }: {
      bookingId: string;
      amount: string;
      method: PaymentMethod;
      direction?: PaymentDirection;
      reference?: string;
      note?: string;
    }) => api.post<BookingDetail>(`/bookings/${bookingId}/payments`, { amount, method, direction, reference, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking"] });
      qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, paymentId }: { bookingId: string; paymentId: string }) =>
      api.delete<BookingDetail>(`/bookings/${bookingId}/payments/${paymentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking"] });
      qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; phone: string; team_name?: string; notes?: string }) =>
      api.post<Customer>("/customers", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{ name: string; phone: string; team_name: string; notes: string }>) =>
      api.patch<Customer>(`/customers/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: queryKeys.customer(id) });
    },
  });
}

export function useCreatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<PricingRule, "id" | "is_active">) => api.post<PricingRule>("/pricing-rules", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pricingRules() }),
  });
}

export function useUpdatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<PricingRule> & { id: string }) => api.patch<PricingRule>(`/pricing-rules/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pricingRules() }),
  });
}

export function useDeletePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pricing-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pricingRules() }),
  });
}

export function useCreateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sport?: string }) => api.post<Field>("/fields", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fields() }),
  });
}

export function useUpdateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<Field> & { id: string }) => api.patch<Field>(`/fields/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fields() }),
  });
}

export function useUpdateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Venue>) => api.patch<Venue>("/settings/venue", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.venue() }),
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; phone: string; password: string; role: "owner" | "staff" }) =>
      api.post<Staff>("/staff", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff() }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; is_active?: boolean; role?: "owner" | "staff"; name?: string }) =>
      api.patch<Staff>(`/staff/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff() }),
  });
}

export function useCreateBlockedSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { field_id: string; starts_at: string; ends_at: string; reason?: string }) =>
      api.post<BlockedSlot>("/blocked-slots", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blockedSlots() });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useDeleteBlockedSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/blocked-slots/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blockedSlots() });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}
