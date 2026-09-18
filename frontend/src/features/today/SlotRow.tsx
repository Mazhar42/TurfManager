import { Lock, Plus } from "lucide-react";
import type { Slot } from "@/lib/types";
import { formatTimeRange } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { Badge, slotStateTone } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<Slot["state"], string> = {
  available: "Available",
  booked: "Booked",
  blocked: "Blocked",
  past: "Past",
};

export function SlotRow({ slot, tz, onClick }: { slot: Slot; tz?: string; onClick: () => void }) {
  const isAvailable = slot.state === "available";
  const isBooked = slot.state === "booked";

  return (
    <button
      onClick={onClick}
      disabled={slot.state === "past" && !isBooked}
      className={cn(
        "group flex w-full items-center gap-3 border-b border-border px-3.5 py-3 text-left transition-colors last:border-b-0",
        isAvailable && "hover:bg-brand-soft/60 cursor-pointer",
        isBooked && "hover:bg-surface-raised cursor-pointer",
        slot.state === "blocked" && "cursor-default",
        slot.state === "past" && !isBooked && "cursor-default opacity-60",
      )}
    >
      <div className="w-24 shrink-0">
        <p className="text-sm font-semibold tabular text-text">{formatTimeRange(slot.starts_at, slot.ends_at, tz)}</p>
      </div>

      <div className="min-w-0 flex-1">
        {isBooked && slot.booking ? (
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-text">{slot.booking.customer_name}</p>
            {slot.booking.due_amount !== "0.00" && (
              <Badge tone="due" className="shrink-0">
                Due {formatMoney(slot.booking.due_amount)}
              </Badge>
            )}
          </div>
        ) : slot.state === "blocked" ? (
          <p className="flex items-center gap-1.5 text-sm text-text-muted">
            <Lock size={13} /> {slot.blocked_reason || "Blocked"}
          </p>
        ) : (
          <p className="text-sm text-text-faint">{STATE_LABEL[slot.state]}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isBooked && <span className="text-sm font-medium tabular text-text-muted">{formatMoney(slot.price)}</span>}
        {isAvailable && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand-strong opacity-0 transition-opacity group-hover:opacity-100">
            <Plus size={15} />
          </span>
        )}
        {!isAvailable && <Badge tone={slotStateTone[slot.state]}>{STATE_LABEL[slot.state]}</Badge>}
      </div>
    </button>
  );
}
