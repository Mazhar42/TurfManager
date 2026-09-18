import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useCreatePricingRule, useDeletePricingRule, useFields, usePricingRules, useUpdatePricingRule } from "@/lib/queries";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PricingSettings() {
  const { data: rules, isLoading } = usePricingRules();
  const { data: fields } = useFields();
  const createRule = useCreatePricingRule();
  const updateRule = useUpdatePricingRule();
  const deleteRule = useDeletePricingRule();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [fieldId, setFieldId] = useState<string>("");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("23:00");
  const [price, setPrice] = useState("");
  const [priority, setPriority] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setLabel("");
    setFieldId("");
    setDays([0, 1, 2, 3, 4]);
    setStart("06:00");
    setEnd("23:00");
    setPrice("");
    setPriority(0);
    setError(null);
  };

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  const submit = async () => {
    setError(null);
    if (!label.trim() || days.length === 0 || !price || Number(price) <= 0) {
      setError("Fill in a label, at least one day, and a price.");
      return;
    }
    try {
      await createRule.mutateAsync({
        field_id: fieldId || null,
        label: label.trim(),
        days,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        price,
        priority,
        valid_from: null,
        valid_to: null,
      });
      show("Pricing rule added");
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save rule.");
    }
  };

  const toggleRuleActive = async (id: string, is_active: boolean) => {
    try {
      await updateRule.mutateAsync({ id, is_active: !is_active });
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update rule.", "error");
    }
  };

  const removeRule = async (id: string) => {
    if (!window.confirm("Delete this pricing rule?")) return;
    try {
      await deleteRule.mutateAsync(id);
      show("Rule deleted");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't delete rule.", "error");
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} /> Add rule
        </Button>
      </div>

      {!rules || rules.length === 0 ? (
        <EmptyState title="No pricing rules yet" description="Add one so bookings auto-price correctly." />
      ) : (
        rules
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text">{r.label}</p>
                  <p className="text-xs text-text-muted">
                    {r.days.map((d) => DAY_LABELS[d]).join(", ")} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                    {r.field_id ? "" : " · all fields"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold tabular text-text">{formatMoney(r.price)}</span>
                  <button onClick={() => removeRule(r.id)} className="text-text-faint hover:text-danger" aria-label="Delete rule">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <button
                onClick={() => toggleRuleActive(r.id, r.is_active)}
                className={cn(
                  "mt-2 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  r.is_active ? "bg-brand-soft text-brand-strong" : "bg-surface-raised text-text-faint",
                )}
              >
                {r.is_active ? "Active" : "Inactive"}
              </button>
            </div>
          ))
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New pricing rule"
        footer={
          <Button className="w-full" onClick={submit} disabled={createRule.isPending}>
            {createRule.isPending ? "Saving…" : "Save rule"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="p-label">Label</Label>
            <Input id="p-label" placeholder="Weekday evening" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-field">Applies to</Label>
            <Select id="p-field" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
              <option value="">All fields</option>
              {fields?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Days</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label2, i) => (
                <button
                  key={label2}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium",
                    days.includes(i) ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-text-muted",
                  )}
                >
                  {label2}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-start">From</Label>
              <Input id="p-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-end">To</Label>
              <Input id="p-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-price">Price</Label>
              <Input id="p-price" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-priority">Priority</Label>
              <Input id="p-priority" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-text-faint">Higher priority wins when rules overlap — use it for holiday overrides.</p>
          <FieldError>{error ?? undefined}</FieldError>
        </div>
      </Sheet>
    </div>
  );
}
