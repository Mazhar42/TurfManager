import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/auth";
import { useMonthlyReport, useOutstandingReport } from "@/lib/queries";
import { currentMonth, formatTimeRange } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaymentStatusBadge } from "@/components/ui/Badge";
import { Wallet } from "lucide-react";

export function ReportsPage() {
  const { venue } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const { data: monthly, isLoading } = useMonthlyReport(month);
  const { data: outstanding, isLoading: outstandingLoading } = useOutstandingReport();

  const chartData = useMemo(
    () => (monthly?.revenue_by_day ?? []).map((d) => ({ day: d.date.slice(8, 10), revenue: Number(d.revenue) })),
    [monthly],
  );

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Reports</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text"
        />
      </div>

      {isLoading || !monthly ? (
        <Skeleton className="h-64 w-full" />
      ) : monthly.total_bookings === 0 ? (
        <EmptyState title="No bookings this month" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Bookings" value={String(monthly.total_bookings)} />
            <MiniStat label="Gross revenue" value={formatMoney(monthly.gross_revenue)} tone="brand" />
            <MiniStat label="Collected" value={formatMoney(monthly.collected)} />
            <MiniStat label="Outstanding" value={formatMoney(monthly.outstanding)} tone={Number(monthly.outstanding) > 0 ? "due" : undefined} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by day</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: -20, top: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      formatter={(v) => formatMoney(Number(v))}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top customers</CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.top_customers.length === 0 ? (
                <p className="text-sm text-text-faint">No repeat customers yet this month.</p>
              ) : (
                <ul className="space-y-2">
                  {monthly.top_customers.map((c, i) => (
                    <li key={c.customer_id} className="flex items-center justify-between text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[11px] font-semibold text-text-muted">
                          {i + 1}
                        </span>
                        <span className="truncate text-text">{c.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular text-text">{formatMoney(c.total_spent)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-muted">
            <Wallet size={15} /> Outstanding dues
          </h2>
          {outstanding && Number(outstanding.total_outstanding) > 0 && (
            <span className="text-sm font-semibold tabular text-[var(--due-text)]">{formatMoney(outstanding.total_outstanding)}</span>
          )}
        </div>
        {outstandingLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !outstanding || outstanding.items.length === 0 ? (
          <EmptyState title="All settled" description="No outstanding dues right now." />
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {outstanding.items.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{b.customer.name}</p>
                  <p className="text-xs text-text-muted">{formatTimeRange(b.starts_at, b.ends_at, venue?.timezone)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular text-[var(--due-text)]">{formatMoney(b.due_amount)}</span>
                  <PaymentStatusBadge status={b.payment_status} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "brand" | "due" }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-text-faint">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular ${tone === "brand" ? "text-brand" : tone === "due" ? "text-[var(--due-text)]" : "text-text"}`}>
        {value}
      </p>
    </div>
  );
}
