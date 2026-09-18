import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBookingsList } from "@/lib/queries";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { formatDateTimeShort } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import type { BookingStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: BookingStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

export function BookingsPage() {
  const { venue } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BookingStatus | "">("");

  const { data: bookings, isLoading } = useBookingsList({ q: q || undefined, status: status || undefined });

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6">
      <h1 className="mb-4 text-lg font-semibold text-text">Bookings</h1>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <Input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | "")} className="w-40 shrink-0">
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <EmptyState title="No bookings found" description="Try a different search or filter." />
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => navigate(`/bookings/${b.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left shadow-sm transition-colors hover:border-border-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{b.customer.name}</p>
                  <p className="text-xs text-text-muted">{formatDateTimeShort(b.starts_at, venue?.timezone)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular text-text">{formatMoney(b.price_amount)}</span>
                  <div className="flex gap-1">
                    <BookingStatusBadge status={b.status} />
                    <PaymentStatusBadge status={b.payment_status} />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
