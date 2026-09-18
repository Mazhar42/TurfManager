import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBookingsList, useTodayCollections } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { formatDateTimeShort } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaymentStatusBadge } from "@/components/ui/Badge";

const METHOD_LABEL: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", card: "Card", bank: "Bank" };

export function PaymentsPage() {
  const { venue } = useAuth();
  const navigate = useNavigate();
  const { data: collections, isLoading: collectionsLoading } = useTodayCollections();
  const { data: unpaid, isLoading: unpaidLoading } = useBookingsList({});

  const dueBookings = useMemo(
    () => (unpaid ?? []).filter((b) => Number(b.due_amount) > 0 && b.status !== "cancelled").sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [unpaid],
  );
  const totalDue = dueBookings.reduce((s, b) => s + Number(b.due_amount), 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6">
      <h1 className="mb-4 text-lg font-semibold text-text">Payments</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Today's collections</CardTitle>
        </CardHeader>
        <CardContent>
          {collectionsLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <>
              <p className="text-2xl font-semibold tabular text-brand">{formatMoney(collections?.total ?? "0")}</p>
              {collections && collections.by_method.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {collections.by_method.map((m) => (
                    <span key={m.method} className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-text-muted">
                      {METHOD_LABEL[m.method] ?? m.method}: {formatMoney(m.amount)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-text-faint">No payments recorded yet today.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-muted">
          <Wallet size={15} /> Outstanding dues
        </h2>
        {dueBookings.length > 0 && <span className="text-sm font-semibold tabular text-[var(--due-text)]">{formatMoney(totalDue)}</span>}
      </div>

      {unpaidLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : dueBookings.length === 0 ? (
        <EmptyState title="All settled" description="No outstanding dues right now." />
      ) : (
        <ul className="space-y-2">
          {dueBookings.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => navigate(`/bookings/${b.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left shadow-sm hover:border-border-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{b.customer.name}</p>
                  <p className="text-xs text-text-muted">{formatDateTimeShort(b.starts_at, venue?.timezone)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular text-[var(--due-text)]">{formatMoney(b.due_amount)}</span>
                  <PaymentStatusBadge status={b.payment_status} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
