import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useFields, useUpdateBooking } from "@/lib/queries";
import { addMinutes, localDateOf, localTimeOf } from "@/lib/datetime";
import { ApiError } from "@/lib/api";
import type { BookingDetail } from "@/lib/types";

const DURATIONS = [60, 90, 120];

/** Move a booking to another day/time/field, or change its price. Times are sent as the
 * venue's local wall clock (no offset) — the server interprets them in venue time. */
export function RescheduleForm({
  booking,
  timezone,
  onDone,
}: {
  booking: BookingDetail;
  timezone?: string;
  onDone: () => void;
}) {
  const { data: fields } = useFields();
  const update = useUpdateBooking();
  const { show } = useToast();

  const currentMinutes = Math.round((new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60000);
  const [date, setDate] = useState(localDateOf(booking.starts_at, timezone));
  const [start, setStart] = useState(localTimeOf(booking.starts_at, timezone));
  const [duration, setDuration] = useState(currentMinutes);
  const [fieldId, setFieldId] = useState(booking.field_id);
  const [price, setPrice] = useState(booking.price_amount);
  const [error, setError] = useState<string | null>(null);

  const durations = DURATIONS.includes(currentMinutes) ? DURATIONS : [currentMinutes, ...DURATIONS];
  const activeFields = (fields ?? []).filter((f) => f.is_active || f.id === booking.field_id);

  const submit = async () => {
    setError(null);
    if (!date || !start) {
      setError("Pick a date and start time.");
      return;
    }
    if (!price || Number(price) < 0) {
      setError("Enter a valid price.");
      return;
    }
    try {
      await update.mutateAsync({
        id: booking.id,
        starts_at: `${date}T${start}:00`,
        ends_at: addMinutes(date, start, duration),
        field_id: fieldId,
        price_amount: price,
      });
      show("Booking updated");
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
        setError("That time is already booked or blocked. Pick another slot.");
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't update the booking.");
      }
    }
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-surface-raised p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="rs-date">Date</Label>
          <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rs-start">Start</Label>
          <Input id="rs-start" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rs-duration">Duration</Label>
          <Select id="rs-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {durations.map((m) => (
              <option key={m} value={m}>
                {m % 60 === 0 ? `${m / 60} hr` : `${(m / 60).toFixed(1)} hr`}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="rs-price">Price</Label>
          <Input id="rs-price" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      {activeFields.length > 1 && (
        <div>
          <Label htmlFor="rs-field">Field</Label>
          <Select id="rs-field" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
            {activeFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      <Button size="sm" className="w-full" onClick={submit} disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
