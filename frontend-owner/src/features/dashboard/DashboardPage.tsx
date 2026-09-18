import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, CircleDollarSign, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useDailyReport, useFields, useMonthlyReport, useOutstandingReport, useTodayBookings } from "@/lib/queries";
import { currentMonth, formatFullDate, formatTimeRange, greeting, todayStr } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";

export function DashboardPage() {
  const { user, venue } = useAuth();
  const navigate = useNavigate();
  const today = todayStr();

  const { data: daily, isLoading: dailyLoading } = useDailyReport(today);
  const { data: bookings, isLoading: bookingsLoading } = useTodayBookings();
  const { data: fields } = useFields();
  const { data: monthly } = useMonthlyReport(currentMonth());
  const { data: outstanding } = useOutstandingReport();

  const fieldName = (id: string) => fields?.find((f) => f.id === id)?.name ?? "Field";

  const nextUp = useMemo(() => {
    if (!bookings) return null;
    const now = new Date();
    const active = bookings
      .filter((b) => b.status === "confirmed" || b.status === "pending")
      .filter((b) => new Date(b.ends_at) > now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return active[0] ?? null;
  }, [bookings]);

  const sortedToday = useMemo(
    () => (bookings ?? []).filter((b) => b.status !== "cancelled").sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [bookings],
  );

  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold text-text">
          {greeting()}, {user?.name?.split(" ")[0] ?? "Owner"}
        </h1>
        <p className="text-sm text-text-muted">{formatFullDate(today, venue?.timezone)}</p>
      </div>

      {/* Hero: today's money */}
      <Card className="overflow-hidden bg-gradient-to-br from-brand to-brand-strong text-brand-contrast shadow-md">
        <CardContent className="pt-4">
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">Today's revenue</p>
          {dailyLoading || !daily ? (
            <Skeleton className="mt-1.5 h-9 w-32 bg-white/20" />
          ) : (
            <p className="mt-0.5 text-3xl font-bold tabular">{formatMoney(daily.gross_revenue)}</p>
          )}
          <div className="mt-4 flex gap-6">
            <div>
              <p className="text-xs opacity-75">Collected</p>
              <p className="text-base font-semibold tabular">{daily ? formatMoney(daily.collected) : "—"}</p>
            </div>
            <div>
              <p className="text-xs opacity-75">Due</p>
              <p className="text-base font-semibold tabular">{daily ? formatMoney(daily.outstanding) : "—"}</p>
            </div>
            <div>
              <p className="text-xs opacity-75">Bookings</p>
              <p className="text-base font-semibold tabular">{daily ? daily.bookings : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right now */}
      <Card>
        <CardContent className="flex items-center gap-3 pt-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <CalendarClock size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-faint">Right now</p>
            {bookingsLoading ? (
              <Skeleton className="mt-1 h-4 w-40" />
            ) : nextUp ? (
              <p className="truncate text-sm font-medium text-text">
                {fieldName(nextUp.field_id)} · {formatTimeRange(nextUp.starts_at, nextUp.ends_at, venue?.timezone)} · {nextUp.customer.name}
              </p>
            ) : (
              <p className="text-sm text-text-muted">Nothing else booked today</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's schedule, compact */}
      <div>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-sm font-semibold text-text-muted">Today's schedule</h2>
          <span className="text-xs text-text-faint">{sortedToday.length} booking{sortedToday.length === 1 ? "" : "s"}</span>
        </div>
        {bookingsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : sortedToday.length === 0 ? (
          <EmptyState title="No bookings yet today" icon={<CalendarClock size={22} />} />
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {sortedToday.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-semibold tabular text-text">{formatTimeRange(b.starts_at, b.ends_at, venue?.timezone).split(" – ")[0]}</p>
                  <p className="text-xs text-text-faint">{fieldName(b.field_id)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{b.customer.name}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <BookingStatusBadge status={b.status} />
                  {Number(b.due_amount) > 0 && <PaymentStatusBadge status={b.payment_status} />}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* This month */}
      <button onClick={() => navigate("/reports")} className="block w-full text-left">
        <Card className="transition-colors hover:border-border-strong">
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
              <TrendingUp size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-text-faint">This month</p>
              {monthly ? (
                <p className="text-sm font-medium text-text">
                  {formatMoney(monthly.gross_revenue)} · {monthly.total_bookings} bookings
                </p>
              ) : (
                <Skeleton className="mt-1 h-4 w-36" />
              )}
            </div>
            <ArrowRight size={16} className="shrink-0 text-text-faint" />
          </CardContent>
        </Card>
      </button>

      {/* Outstanding dues */}
      {outstanding && Number(outstanding.total_outstanding) > 0 && (
        <button onClick={() => navigate("/reports")} className="block w-full text-left">
          <Card className="border-[var(--due-border)] bg-[var(--due-bg)] transition-opacity hover:opacity-90">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60 text-[var(--due-text)]">
                <CircleDollarSign size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--due-text)] opacity-80">Outstanding dues</p>
                <p className="text-sm font-semibold tabular text-[var(--due-text)]">
                  {formatMoney(outstanding.total_outstanding)} across {outstanding.items.length} booking{outstanding.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[var(--due-text)]" />
            </CardContent>
          </Card>
        </button>
      )}
    </div>
  );
}
