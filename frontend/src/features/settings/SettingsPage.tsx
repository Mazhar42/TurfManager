import { useState } from "react";
import { cn } from "@/lib/utils";
import { VenueSettings } from "@/features/settings/VenueSettings";
import { FieldsSettings } from "@/features/settings/FieldsSettings";
import { PricingSettings } from "@/features/settings/PricingSettings";
import { StaffSettings } from "@/features/settings/StaffSettings";
import { BlockedSlotsSettings } from "@/features/settings/BlockedSlotsSettings";

const TABS = [
  { key: "venue", label: "Venue" },
  { key: "fields", label: "Fields" },
  { key: "pricing", label: "Pricing" },
  { key: "blocks", label: "Blocks" },
  { key: "staff", label: "Staff" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("venue");

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6">
      <h1 className="mb-4 text-lg font-semibold text-text">Settings</h1>

      <div className="scroll-thin mb-5 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-brand text-brand-contrast" : "text-text-muted hover:bg-surface-raised",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "venue" && <VenueSettings />}
      {tab === "fields" && <FieldsSettings />}
      {tab === "pricing" && <PricingSettings />}
      {tab === "blocks" && <BlockedSlotsSettings />}
      {tab === "staff" && <StaffSettings />}
    </div>
  );
}
