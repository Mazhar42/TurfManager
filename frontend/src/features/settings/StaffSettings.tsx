import { useState } from "react";
import { Plus } from "lucide-react";
import { useCreateStaff, useStaffList, useUpdateStaff } from "@/lib/queries";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import type { UserRole } from "@/lib/types";

export function StaffSettings() {
  const { data: staff, isLoading } = useStaffList();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !phone.trim() || password.length < 6) {
      setError("Name, phone and a password of at least 6 characters are required.");
      return;
    }
    try {
      await createStaff.mutateAsync({ name: name.trim(), phone: phone.trim(), password, role });
      show(`Added ${name}`);
      setOpen(false);
      setName("");
      setPhone("");
      setPassword("");
      setRole("staff");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add staff member.");
    }
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    try {
      await updateStaff.mutateAsync({ id, is_active: !is_active });
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update staff.", "error");
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} /> Add staff
        </Button>
      </div>

      {staff?.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium text-text">{s.name}</p>
            <p className="text-xs text-text-muted">
              {s.phone} · <span className="capitalize">{s.role}</span>
            </p>
          </div>
          <button
            onClick={() => toggleActive(s.id, s.is_active)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${s.is_active ? "bg-brand-soft text-brand-strong" : "bg-surface-raised text-text-faint"}`}
          >
            {s.is_active ? "Active" : "Suspended"}
          </button>
        </div>
      ))}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add staff member"
        footer={
          <Button className="w-full" onClick={submit} disabled={createStaff.isPending}>
            {createStaff.isPending ? "Saving…" : "Add staff member"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="s-phone">Phone (used to log in)</Label>
            <Input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="s-password">Temporary password</Label>
            <Input id="s-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="s-role">Role</Label>
            <Select id="s-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </Select>
          </div>
          <FieldError>{error ?? undefined}</FieldError>
        </div>
      </Sheet>
    </div>
  );
}
