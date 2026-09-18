import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Plus, Search } from "lucide-react";
import { useCreateCustomer, useCustomers } from "@/lib/queries";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";

export function CustomersPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [q, setQ] = useState("");
  const { data: customers, isLoading } = useCustomers(q);
  const [addOpen, setAddOpen] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [team, setTeam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createCustomer = useCreateCustomer();

  const submit = async () => {
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    try {
      const c = await createCustomer.mutateAsync({ name: name.trim(), phone: phone.trim(), team_name: team.trim() || undefined });
      show(`Added ${c.name}`);
      setAddOpen(false);
      setName("");
      setPhone("");
      setTeam("");
      navigate(`/customers/${c.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add customer.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Customers</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={15} /> Add
        </Button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
        <Input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !customers || customers.length === 0 ? (
        <EmptyState title="No customers yet" description="Customers are added automatically from bookings, or you can add one here." />
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => navigate(`/customers/${c.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left shadow-sm hover:border-border-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{c.name}</p>
                  {c.team_name && <p className="truncate text-xs text-text-muted">{c.team_name}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-sm text-text-muted">
                  <Phone size={13} /> {c.phone}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add customer"
        footer={
          <Button className="w-full" onClick={submit} disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Saving…" : "Save customer"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-team">Team name (optional)</Label>
            <Input id="c-team" value={team} onChange={(e) => setTeam(e.target.value)} />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
        </div>
      </Sheet>
    </div>
  );
}
