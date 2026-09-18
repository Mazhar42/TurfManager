import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDailyReport, useMonthlyReport } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { todayStr } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data: daily, isLoading: dailyLoading } = useDailyReport(todayStr());
  const { data: monthly, isLoading: monthlyLoading } = useMonthlyReport(month);

  const chartData = useMemo(
    () => (monthly?.revenue_by_day ?? []).map((d) => ({ day: d.date.slice(8, 10), revenue: Number(d.revenue) })),
    [monthly],
  );

  const hourData = useMemo(() => {
    const map = new Map((monthly?.bookings_by_hour ?? []).map((h) => [h.hour, h.bookings]));
    return Array.from({ length: 18 }, (_, i) => {
      const hour = i + 6; // venues typically open 6am
      return { hour: `${hour}`, bookings: map.get(hour) ?? 0 };
    });
  }, [monthly]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:py-6">
      <h1 className="mb-4 text-lg font-semibold text-text">Reports</h1>

      <h2 className="mb-2 text-sm font-semibold text-text-muted">Today</h2>
      <div className="mb-6 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {dailyLoading || !daily ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : (
          <>
            <MiniStat label="Bookings" value={String(daily.bookings)} />
            <MiniStat label="Revenue" value={formatMoney(daily.gross_revenue)} tone="brand" />
            <MiniStat label="Collected" value={formatMoney(daily.collected)} />
            <MiniStat label="Outstanding" value={formatMoney(daily.outstanding)} tone={Number(daily.outstanding) > 0 ? "due" : undefined} />
            <MiniStat label="Cancelled" value={String(daily.cancelled)} />
            <MiniStat label="Available" value={String(daily.available_slots)} />
          </>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-muted">Monthly</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text"
        />
      </div>

      {monthlyLoading || !monthly ? (
        <Skeleton className="h-64 w-full" />
      ) : monthly.total_bookings === 0 ? (
        <EmptyState title="No bookings this month" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MiniStat label="Bookings" value={String(monthly.total_bookings)} />
            <MiniStat label="Booked hours" value={Number(monthly.booked_hours).toFixed(0)} />
            <MiniStat label="Gross revenue" value={formatMoney(monthly.gross_revenue)} tone="brand" />
            <MiniStat label="Outstanding" value={formatMoney(monthly.outstanding)} tone={Number(monthly.outstanding) > 0 ? "due" : undefined} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by day</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: -20, top: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={44} />
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
              <CardTitle>Bookings by hour</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourData} margin={{ left: -20, top: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                    <Bar dataKey="bookings" fill="var(--brand)" opacity={0.75} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-xs text-text-faint">Hour of day (venue local time)</p>
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
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised text-[11px] font-semibold text-text-muted">
                          {i + 1}
                        </span>
                        <span className="text-text">{c.name}</span>
                        <span className="text-text-faint">· {c.bookings} bookings</span>
                      </span>
                      <span className="font-semibold tabular text-text">{formatMoney(c.total_spent)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "brand" | "due" }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-text-faint">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold tabular ${tone === "brand" ? "text-brand" : tone === "due" ? "text-[var(--due-text)]" : "text-text"}`}
      >
        {value}
      </p>
    </div>
  );
}
