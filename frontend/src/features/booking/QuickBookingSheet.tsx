import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { useCreateBooking, useCustomers } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { addMinutes, formatDayLabel, formatTimeRange } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { Field, PaymentMethod } from "@/lib/types";

interface FixedSlot {
  fieldId: string;
  startsAt: string;
  endsAt: string;
}

interface QuickBookingSheetProps {
  open: boolean;
  onClose: () => void;
  fields: Field[];
  defaultDate: string;
  fixedSlot?: FixedSlot;
  onCreated?: (bookingId: string) => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank" },
];

const DURATIONS = [60, 90, 120];

export function QuickBookingSheet({ open, onClose, fields, defaultDate, fixedSlot, onCreated }: QuickBookingSheetProps) {
  const { show } = useToast();
  const createBooking = useCreateBooking();

  const [fieldId, setFieldId] = useState(fixedSlot?.fieldId ?? fields[0]?.id ?? "");
  const [date] = useState(defaultDate);
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState(60);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [price, setPrice] = useState<string>("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [advance, setAdvance] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);

  const phoneQuery = useCustomers(phone.length >= 3 ? phone : "");

  useEffect(() => {
    if (!open) return;
    setFieldId(fixedSlot?.fieldId ?? fields[0]?.id ?? "");
    setStartTime("18:00");
    setDuration(60);
    setPhone("");
    setName("");
    setSelectedCustomerId(null);
    setPrice("");
    setPriceTouched(false);
    setAdvance("");
    setMethod("cash");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedSlot?.startsAt, fixedSlot?.fieldId]);

  const { startsAt, endsAt } = useMemo(() => {
    if (fixedSlot) return { startsAt: fixedSlot.startsAt, endsAt: fixedSlot.endsAt };
    // Deliberately NOT `new Date(...).toISOString()` — that bakes in the browser's own
    // timezone offset. We send a plain "naive" local wall-clock string instead; the
    // backend's `localize()` treats a timezone-less timestamp as the venue's own local
    // time, which is what a staff member picking "6:00 PM" on this form actually means.
    return { startsAt: `${date}T${startTime}:00`, endsAt: addMinutes(date, startTime, duration) };
  }, [fixedSlot, date, startTime, duration]);

  const quoteRequestId = useRef(0);
  useEffect(() => {
    if (!open || !fieldId || priceTouched) return;
    const id = ++quoteRequestId.current;
    setPriceLoading(true);
    api
      .post<{ price: string }>("/pricing/quote", { field_id: fieldId, starts_at: startsAt, ends_at: endsAt })
      .then((res) => {
        if (quoteRequestId.current === id) setPrice(res.price);
      })
      .catch(() => {})
      .finally(() => {
        if (quoteRequestId.current === id) setPriceLoading(false);
      });
  }, [open, fieldId, startsAt, endsAt, priceTouched]);

  const due = Math.max(0, Number(price || 0) - Number(advance || 0));

  const submit = async () => {
    setError(null);
    if (!fieldId) return setError("Choose a field.");
    if (!selectedCustomerId && (!name.trim() || !phone.trim())) {
      return setError("Enter the customer's name and phone.");
    }
    if (!price || Number(price) <= 0) return setError("Enter a price.");

    try {
      const booking = await createBooking.mutateAsync({
        field_id: fieldId,
        starts_at: startsAt,
        ends_at: endsAt,
        customer_id: selectedCustomerId ?? undefined,
        customer_name: selectedCustomerId ? undefined : name.trim(),
        customer_phone: selectedCustomerId ? undefined : phone.trim(),
        price_amount: price,
        advance_amount: advance || undefined,
        advance_method: advance ? method : undefined,
      });
      show(`Booked — ${booking.customer.name}, ${formatTimeRange(booking.starts_at, booking.ends_at)}`);
      onCreated?.(booking.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
        const conflictName = (err.details?.customer_name as string) ?? "someone else";
        setError(`Already booked by ${conflictName}. Pick another slot.`);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  const fieldName = fields.find((f) => f.id === fieldId)?.name;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New booking"
      footer={
        <Button className="w-full" size="lg" onClick={submit} disabled={createBooking.isPending}>
          {createBooking.isPending ? "Confirming…" : `Confirm booking${price ? ` · ${formatMoney(price)}` : ""}`}
        </Button>
      }
    >
      <div className="space-y-4">
        {fixedSlot ? (
          <div className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm font-medium text-brand-strong">
            {fieldName} · {formatDayLabel(date)} · {formatTimeRange(startsAt, endsAt)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="field">Field</Label>
              <Select id="field" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="start">Start time</Label>
              <Input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="duration">Duration</Label>
              <Select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="relative">
          <Label htmlFor="phone">Customer phone</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoFocus={!!fixedSlot}
            placeholder="017XXXXXXXX"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setSelectedCustomerId(null);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && phoneQuery.data && phoneQuery.data.length > 0 && !selectedCustomerId && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
              {phoneQuery.data.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-surface-raised"
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setPhone(c.phone);
                    setName(c.name);
                    setShowSuggestions(false);
                  }}
                >
                  <span className="text-sm font-medium text-text">{c.name}</span>
                  <span className="text-xs text-text-muted">
                    {c.phone}
                    {c.team_name ? ` · ${c.team_name}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="name">Customer / team name</Label>
          <Input
            id="name"
            placeholder="Rahim FC"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSelectedCustomerId(null);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              placeholder={priceLoading ? "…" : "0"}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceTouched(true);
              }}
            />
          </div>
          <div>
            <Label htmlFor="advance">Advance received</Label>
            <Input
              id="advance"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
            />
          </div>
        </div>

        {Number(advance) > 0 && (
          <div>
            <Label>Payment method</Label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    method === m.value
                      ? "border-brand bg-brand-soft text-brand-strong"
                      : "border-border text-text-muted hover:border-border-strong",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {price && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm">
            <span className="text-text-muted">Due at confirmation</span>
            <span className="font-semibold tabular text-text">{formatMoney(due)}</span>
          </div>
        )}

        <FieldError>{error ?? undefined}</FieldError>
      </div>
    </Sheet>
  );
}
