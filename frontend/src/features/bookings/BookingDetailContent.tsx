import { useState } from "react";
import { CalendarClock, Phone, Receipt, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { useAddPayment, useBooking, useDeletePayment, useUpdateBookingStatus } from "@/lib/queries";
import { formatDateTimeShort, formatDayLabel, formatTimeRange, localDateOf } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/lib/api";
import { BOOKING_STATUS_TRANSITIONS, STATUS_ACTION_LABEL } from "@/features/bookings/statusTransitions";
import { BookingHistory } from "@/features/bookings/BookingHistory";
import { RescheduleForm } from "@/features/bookings/RescheduleForm";
import type { BookingStatus, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank" },
];

export function BookingDetailContent({ bookingId, onChanged }: { bookingId: string; onChanged?: () => void }) {
  const { data: booking, isLoading } = useBooking(bookingId);
  const { user, venue } = useAuth();
  const { show } = useToast();
  const updateStatus = useUpdateBookingStatus();
  const addPayment = useAddPayment();
  const deletePaymentMutation = useDeletePayment();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !booking) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const nextStatuses = BOOKING_STATUS_TRANSITIONS[booking.status];
  const canReschedule = booking.status === "pending" || booking.status === "confirmed";

  const handleStatus = async (status: BookingStatus) => {
    if (status === "cancelled" && !window.confirm("Cancel this booking? This frees up the slot.")) return;
    try {
      await updateStatus.mutateAsync({ id: booking.id, status });
      show(status === "cancelled" ? "Booking cancelled" : `Booking marked ${status.replace("_", " ")}`);
      onChanged?.();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update the booking.", "error");
    }
  };

  const submitPayment = async () => {
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount.");
      return;
    }
    try {
      await addPayment.mutateAsync({ bookingId: booking.id, amount, method });
      show(`Payment recorded — ${formatMoney(amount)}`);
      setAmount("");
      setShowPaymentForm(false);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't record the payment.");
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!window.confirm("Delete this payment record?")) return;
    try {
      await deletePaymentMutation.mutateAsync({ bookingId: booking.id, paymentId });
      show("Payment deleted");
      onChanged?.();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't delete the payment.", "error");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-text">{booking.customer.name}</h3>
            <a href={`tel:${booking.customer.phone}`} className="mt-0.5 flex items-center gap-1.5 text-sm text-text-muted hover:text-brand">
              <Phone size={13} /> {booking.customer.phone}
            </a>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.payment_status} />
          </div>
        </div>
        <p className="mt-3 text-sm text-text-muted">
          {formatDayLabel(localDateOf(booking.starts_at, venue?.timezone), venue?.timezone)} · {formatTimeRange(booking.starts_at, booking.ends_at, venue?.timezone)}
        </p>
        {booking.notes && <p className="mt-2 rounded-lg bg-surface-raised px-3 py-2 text-sm text-text-muted">{booking.notes}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-raised p-3 text-center">
        <div>
          <p className="text-[11px] uppercase text-text-faint">Price</p>
          <p className="text-sm font-semibold tabular text-text">{formatMoney(booking.price_amount)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-text-faint">Paid</p>
          <p className="text-sm font-semibold tabular text-text">{formatMoney(booking.paid_amount)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-text-faint">Due</p>
          <p className={cn("text-sm font-semibold tabular", Number(booking.due_amount) > 0 ? "text-[var(--due-text)]" : "text-text")}>
            {formatMoney(booking.due_amount)}
          </p>
        </div>
      </div>

      {(nextStatuses.length > 0 || canReschedule) && (
        <div className="flex flex-wrap gap-2">
          {canReschedule && (
            <Button size="sm" variant="secondary" onClick={() => setShowReschedule((v) => !v)}>
              <CalendarClock size={14} /> {showReschedule ? "Close" : "Reschedule"}
            </Button>
          )}
          {nextStatuses.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === "cancelled" ? "danger" : s === "confirmed" || s === "completed" ? "primary" : "secondary"}
              onClick={() => handleStatus(s)}
              disabled={updateStatus.isPending}
            >
              {STATUS_ACTION_LABEL[s]}
            </Button>
          ))}
        </div>
      )}

      {showReschedule && canReschedule && (
        <RescheduleForm
          booking={booking}
          timezone={venue?.timezone}
          onDone={() => {
            setShowReschedule(false);
            onChanged?.();
          }}
        />
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-text">
            <Receipt size={15} /> Payments
          </h4>
          {Number(booking.due_amount) > 0 && (
            <button className="text-xs font-medium text-brand hover:underline" onClick={() => setShowPaymentForm((v) => !v)}>
              {showPaymentForm ? "Cancel" : "+ Record payment"}
            </button>
          )}
        </div>

        {showPaymentForm && (
          <div className="mb-3 space-y-2.5 rounded-xl border border-border bg-surface-raised p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="pay-amount">Amount</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  inputMode="decimal"
                  placeholder={booking.due_amount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pay-method">Method</Label>
                <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {error && <p className="text-xs font-medium text-danger">{error}</p>}
            <Button size="sm" className="w-full" onClick={submitPayment} disabled={addPayment.isPending}>
              {addPayment.isPending ? "Saving…" : "Save payment"}
            </Button>
          </div>
        )}

        {booking.payments.length === 0 ? (
          <p className="text-sm text-text-faint">No payments recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {booking.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <span className={cn("font-medium tabular", p.direction === "refund" ? "text-[var(--due-text)]" : "text-text")}>
                    {p.direction === "refund" ? "−" : "+"}
                    {formatMoney(p.amount)}
                  </span>
                  <span className="ml-2 text-text-muted capitalize">{p.method}</span>
                  <span className="ml-2 text-xs text-text-faint">{formatDateTimeShort(p.received_at, venue?.timezone)}</span>
                </div>
                {user?.role === "owner" && (
                  <button onClick={() => deletePayment(p.id)} className="text-text-faint hover:text-danger" aria-label="Delete payment">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <BookingHistory events={booking.events ?? []} timezone={venue?.timezone} />
    </div>
  );
}
