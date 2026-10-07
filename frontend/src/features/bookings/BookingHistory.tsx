import { History } from "lucide-react";
import { formatDateTimeShort } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import type { BookingEvent } from "@/lib/types";

function describe(event: BookingEvent, tz?: string): string {
  const p = event.payload;
  switch (event.event_type) {
    case "created":
      return "Booking created";
    case "status_changed": {
      const label = `Marked ${(event.to_status ?? "").replace("_", " ")}`;
      return p.reason ? `${label} — “${String(p.reason)}”` : label;
    }
    case "rescheduled": {
      const before = p.before as { starts_at?: string } | undefined;
      return before?.starts_at ? `Moved from ${formatDateTimeShort(before.starts_at, tz)}` : "Rescheduled";
    }
    case "repriced": {
      const before = p.before as { price_amount?: string } | undefined;
      const after = p.after as { price_amount?: string } | undefined;
      return `Price changed ${formatMoney(before?.price_amount ?? "0")} → ${formatMoney(after?.price_amount ?? "0")}`;
    }
    case "payment_recorded": {
      const sign = p.direction === "refund" ? "Refund" : "Payment";
      return `${sign} ${formatMoney(String(p.amount ?? "0"))} (${String(p.method ?? "")})`;
    }
    case "payment_deleted":
      return `Payment ${formatMoney(String(p.amount ?? "0"))} deleted`;
    default:
      return event.event_type;
  }
}

/** The audit trail — answers "who cancelled this?" and "who took that payment?". */
export function BookingHistory({ events, timezone }: { events: BookingEvent[]; timezone?: string }) {
  if (events.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
        <History size={15} /> History
      </h4>
      <ol className="space-y-2 border-l border-border pl-3">
        {events.map((e) => (
          <li key={e.id} className="relative text-sm">
            <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-border" aria-hidden />
            <p className="text-text">{describe(e, timezone)}</p>
            <p className="text-xs text-text-faint">
              {formatDateTimeShort(e.created_at, timezone)}
              {e.actor_name ? ` · ${e.actor_name}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
