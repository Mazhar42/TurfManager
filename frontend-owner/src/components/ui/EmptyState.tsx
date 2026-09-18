import type { ReactNode } from "react";

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="mb-1 text-text-faint">{icon}</div>}
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="max-w-xs text-sm text-text-muted">{description}</p>}
    </div>
  );
}
