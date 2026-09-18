import { useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useBlockedSlots, useCreateBlockedSlot, useDeleteBlockedSlot, useFields } from "@/lib/queries";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { addMinutes, formatDateTimeShort } from "@/lib/datetime";
import { ApiError } from "@/lib/api";

export function BlockedSlotsSettings() {
  const { data: blocks, isLoading } = useBlockedSlots();
  const { data: fields } = useFields();
  const createBlock = useCreateBlockedSlot();
  const deleteBlock = useDeleteBlockedSlot();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [fieldId, setFieldId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("06:00");
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!fieldId || !date) {
      setError("Choose a field and date.");
      return;
    }
    try {
      await createBlock.mutateAsync({
        field_id: fieldId,
        starts_at: `${date}T${start}:00`,
        ends_at: addMinutes(date, start, duration),
        reason: reason.trim() || undefined,
      });
      show("Slot blocked");
      setOpen(false);
      setReason("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't block that slot — it may already be booked.");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this block? The slot will become bookable again.")) return;
    try {
      await deleteBlock.mutateAsync(id);
      show("Block removed");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't remove block.", "error");
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Block off maintenance or private-use time so staff can't book over it.</p>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} /> Block a slot
        </Button>
      </div>

      {!blocks || blocks.length === 0 ? (
        <EmptyState title="No blocked slots" icon={<Lock size={22} />} />
      ) : (
        blocks.map((b) => {
          const field = fields?.find((f) => f.id === b.field_id);
          return (
            <div key={b.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">
                  {field?.name ?? "Field"} · {formatDateTimeShort(b.starts_at)}
                </p>
                {b.reason && <p className="text-xs text-text-muted">{b.reason}</p>}
              </div>
              <button onClick={() => remove(b.id)} className="text-text-faint hover:text-danger" aria-label="Remove block">
                <Trash2 size={15} />
              </button>
            </div>
          );
        })
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Block a slot"
        footer={
          <Button className="w-full" onClick={submit} disabled={createBlock.isPending}>
            {createBlock.isPending ? "Saving…" : "Block slot"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="b-field">Field</Label>
            <Select id="b-field" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
              <option value="">Select a field</option>
              {fields?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="b-date">Date</Label>
            <Input id="b-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="b-start">Start time</Label>
              <Input id="b-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="b-duration">Duration</Label>
              <Select id="b-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {[60, 120, 180, 240].map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="b-reason">Reason (optional)</Label>
            <Input id="b-reason" placeholder="Maintenance" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
        </div>
      </Sheet>
    </div>
  );
}
