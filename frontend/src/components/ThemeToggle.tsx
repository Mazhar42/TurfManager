import { useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const ICONS = { system: SunMoon, light: Sun, dark: Moon };

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>(getStoredTheme());
  const Icon = ICONS[pref];

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(next);
    applyTheme(next);
  };

  return (
    <button
      onClick={cycle}
      className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-raised hover:text-text"
      title={`Theme: ${pref}`}
      aria-label={`Switch theme (currently ${pref})`}
    >
      <Icon size={17} />
    </button>
  );
}
