import { formatMoney } from "@/lib/money";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: string;
  tone?: "default" | "brand" | "due";
}

export function StatRow({ stats, loading }: { stats: Stat[]; loading?: boolean }) {
  return (
    <div className="scroll-thin flex gap-2.5 overflow-x-auto px-3 py-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="min-w-28 flex-1 shrink-0 rounded-2xl border border-border bg-surface px-3.5 py-3 shadow-sm"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-faint">{s.label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-6 w-16" />
          ) : (
            <p
              className={cn(
                "mt-0.5 text-xl font-semibold tabular",
                s.tone === "brand" && "text-brand",
                s.tone === "due" && "text-[var(--due-text)]",
              )}
            >
              {s.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function bookingStatTiles(opts: {
  bookings: number;
  revenue: number;
  collected: number;
  due: number;
  available: number;
}): Stat[] {
  return [
    { label: "Bookings", value: String(opts.bookings) },
    { label: "Revenue", value: formatMoney(opts.revenue), tone: "brand" },
    { label: "Collected", value: formatMoney(opts.collected) },
    { label: "Due", value: formatMoney(opts.due), tone: opts.due > 0 ? "due" : "default" },
    { label: "Available", value: String(opts.available) },
  ];
}
