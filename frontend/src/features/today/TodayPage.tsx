import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAvailability, useBookingsList, useFields } from "@/lib/queries";
import { todayStr } from "@/lib/datetime";
import { DateStrip } from "@/features/today/DateStrip";
import { StatRow, bookingStatTiles } from "@/features/today/StatRow";
import { SlotRow } from "@/features/today/SlotRow";
import { QuickBookingSheet } from "@/features/booking/QuickBookingSheet";
import { BookingDetailSheet } from "@/features/bookings/BookingDetailSheet";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { Slot } from "@/lib/types";

export function TodayPage() {
  const { venue } = useAuth();
  const [date, setDate] = useState(todayStr());
  const { data: fields, isLoading: fieldsLoading } = useFields();
  const [fieldId, setFieldId] = useState<string | undefined>(undefined);
  const activeFieldId = fieldId ?? fields?.[0]?.id;

  const { data: grid, isLoading: gridLoading } = useAvailability(activeFieldId, date);
  const { data: bookings } = useBookingsList({ date });

  const [bookingSheetSlot, setBookingSheetSlot] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [quickBookingOpen, setQuickBookingOpen] = useState(false);

  const stats = useMemo(() => {
    const active = (bookings ?? []).filter((b) => b.status !== "cancelled");
    const revenue = active.reduce((s, b) => s + Number(b.price_amount), 0);
    const collected = active.reduce((s, b) => s + Number(b.paid_amount), 0);
    const due = active.reduce((s, b) => s + Number(b.due_amount), 0);
    const available = (grid?.slots ?? []).filter((s) => s.state === "available").length;
    return bookingStatTiles({ bookings: active.length, revenue, collected, due, available });
  }, [bookings, grid]);

  const openSlot = (slot: Slot) => {
    if (slot.state === "available") {
      setBookingSheetSlot({ startsAt: slot.starts_at, endsAt: slot.ends_at });
    } else if (slot.state === "booked" && slot.booking) {
      setSelectedBookingId(slot.booking.booking_id);
    }
  };

  return (
    <div className="flex flex-col">
      <DateStrip value={date} onChange={setDate} />

      {fields && fields.length > 1 && (
        <div className="scroll-thin flex gap-1.5 overflow-x-auto border-b border-border bg-surface px-3 py-2">
          {fields.map((f) => (
            <button
              key={f.id}
              onClick={() => setFieldId(f.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                activeFieldId === f.id ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-text-muted",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      <StatRow stats={stats} loading={gridLoading && !grid} />

      <div className="px-3 pb-3">
        <div className="flex items-center justify-between py-1">
          <h2 className="text-sm font-semibold text-text-muted">Schedule</h2>
          <Button size="sm" variant="outline" onClick={() => setQuickBookingOpen(true)}>
            <Plus size={15} /> New booking
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {fieldsLoading || gridLoading ? (
            <div className="space-y-0 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="mb-2 h-12 w-full" />
              ))}
            </div>
          ) : !fields || fields.length === 0 ? (
            <EmptyState title="No fields set up yet" description="Add a field in Settings to start taking bookings." />
          ) : (
            grid?.slots.map((slot) => (
              <SlotRow key={slot.starts_at} slot={slot} tz={venue?.timezone} onClick={() => openSlot(slot)} />
            ))
          )}
        </div>
      </div>

      {fields && fields.length > 0 && (
        <QuickBookingSheet
          open={!!bookingSheetSlot || quickBookingOpen}
          onClose={() => {
            setBookingSheetSlot(null);
            setQuickBookingOpen(false);
          }}
          fields={fields}
          defaultDate={date}
          fixedSlot={bookingSheetSlot && activeFieldId ? { fieldId: activeFieldId, startsAt: bookingSheetSlot.startsAt, endsAt: bookingSheetSlot.endsAt } : undefined}
        />
      )}

      <BookingDetailSheet bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
    </div>
  );
}
