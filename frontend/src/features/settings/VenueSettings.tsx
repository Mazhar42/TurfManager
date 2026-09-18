import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useUpdateVenue } from "@/lib/queries";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { ApiError } from "@/lib/api";

export function VenueSettings() {
  const { venue, refreshVenue } = useAuth();
  const { show } = useToast();
  const updateVenue = useUpdateVenue();

  const [form, setForm] = useState({ name: "", address: "", phone: "", opens_at: "06:00", closes_at: "23:00", slot_minutes: 60 });

  useEffect(() => {
    if (venue) {
      setForm({
        name: venue.name,
        address: venue.address ?? "",
        phone: venue.phone ?? "",
        opens_at: venue.opens_at.slice(0, 5),
        closes_at: venue.closes_at.slice(0, 5),
        slot_minutes: venue.slot_minutes,
      });
    }
  }, [venue]);

  const save = async () => {
    try {
      await updateVenue.mutateAsync({
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        opens_at: `${form.opens_at}:00`,
        closes_at: `${form.closes_at}:00`,
        slot_minutes: form.slot_minutes,
      });
      await refreshVenue();
      show("Venue settings saved");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't save settings.", "error");
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div>
        <Label htmlFor="v-name">Venue name</Label>
        <Input id="v-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="v-address">Address</Label>
        <Input id="v-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="v-phone">Phone</Label>
        <Input id="v-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="v-open">Opens</Label>
          <Input id="v-open" type="time" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="v-close">Closes</Label>
          <Input id="v-close" type="time" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="v-slot">Slot (min)</Label>
          <Input
            id="v-slot"
            type="number"
            value={form.slot_minutes}
            onChange={(e) => setForm({ ...form, slot_minutes: Number(e.target.value) })}
          />
        </div>
      </div>
      <Button onClick={save} disabled={updateVenue.isPending}>
        {updateVenue.isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
