import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Phone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBookingsList, useCustomer } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { formatDateTimeShort } from "@/lib/datetime";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { venue } = useAuth();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: bookings } = useBookingsList({ customer_id: id });

  if (isLoading || !customer) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 sm:py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text">
        <ChevronLeft size={16} /> Back
      </button>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">{customer.name}</h1>
          {customer.team_name && <p className="text-sm text-text-muted">{customer.team_name}</p>}
          <a href={`tel:${customer.phone}`} className="mt-1 flex items-center gap-1.5 text-sm text-brand">
            <Phone size={14} /> {customer.phone}
          </a>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <StatCard label="Bookings" value={String(customer.total_bookings)} />
        <StatCard label="Cancelled" value={String(customer.cancelled_bookings)} />
        <StatCard label="Total spent" value={formatMoney(customer.total_spent)} tone="brand" />
        <StatCard label="Outstanding" value={formatMoney(customer.outstanding)} tone={Number(customer.outstanding) > 0 ? "due" : undefined} />
      </div>

      {customer.notes && <p className="mb-5 rounded-xl bg-surface-raised px-3.5 py-2.5 text-sm text-text-muted">{customer.notes}</p>}

      <h2 className="mb-2 text-sm font-semibold text-text-muted">Booking history</h2>
      {!bookings || bookings.length === 0 ? (
        <EmptyState title="No bookings yet" />
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => navigate(`/bookings/${b.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left hover:border-border-strong"
              >
                <div>
                  <p className="text-sm font-medium text-text">{formatDateTimeShort(b.starts_at, venue?.timezone)}</p>
                  <div className="mt-1 flex gap-1">
                    <BookingStatusBadge status={b.status} />
                    <PaymentStatusBadge status={b.payment_status} />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular text-text">{formatMoney(b.price_amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "brand" | "due" }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-text-faint">{label}</p>
      <p className={cn("text-lg font-semibold tabular", tone === "brand" && "text-brand", tone === "due" && "text-[var(--due-text)]")}>{value}</p>
    </div>
  );
}
