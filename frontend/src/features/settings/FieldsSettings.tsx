import { useState } from "react";
import { Plus } from "lucide-react";
import { useCreateField, useFields, useUpdateField } from "@/lib/queries";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";

export function FieldsSettings() {
  const { data: fields, isLoading } = useFields();
  const createField = useCreateField();
  const updateField = useUpdateField();
  const { show } = useToast();
  const [newName, setNewName] = useState("");

  const addField = async () => {
    if (!newName.trim()) return;
    try {
      await createField.mutateAsync({ name: newName.trim() });
      setNewName("");
      show("Field added");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't add field.", "error");
    }
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    try {
      await updateField.mutateAsync({ id, is_active: !is_active });
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update field.", "error");
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      {fields?.map((f) => (
        <div key={f.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium text-text">{f.name}</p>
            <p className="text-xs capitalize text-text-muted">{f.sport}</p>
          </div>
          <button
            onClick={() => toggleActive(f.id, f.is_active)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${f.is_active ? "bg-brand-soft text-brand-strong" : "bg-surface-raised text-text-faint"}`}
          >
            {f.is_active ? "Active" : "Inactive"}
          </button>
        </div>
      ))}

      <div className="flex gap-2 rounded-xl border border-dashed border-border p-3">
        <Input placeholder="New field name (e.g. Field C)" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button size="md" onClick={addField} disabled={createField.isPending}>
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
