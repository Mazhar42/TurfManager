import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Home, LogOut, Moon, PieChart, Sun, SunMoon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/Sheet";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/reports", label: "Reports", icon: PieChart },
];

const THEME_ORDER: ThemePreference[] = ["system", "light", "dark"];
const THEME_ICON = { system: SunMoon, light: Sun, dark: Moon };
const THEME_LABEL = { system: "Match device", light: "Light", dark: "Dark" };

export function AppShell() {
  const { user, venue, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme());

  const cycleTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next);
    applyTheme(next);
  };
  const ThemeIcon = THEME_ICON[theme];

  return (
    <div className="flex min-h-dvh w-full flex-col bg-bg">
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{venue?.name ?? "Turf Owner"}</p>
            <p className="text-xs text-text-faint">Owner overview</p>
          </div>
          <button
            onClick={() => setProfileOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong"
            aria-label="Profile menu"
          >
            {user?.name?.[0]?.toUpperCase() ?? "O"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 pb-24">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex w-full max-w-md">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn("flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium", isActive ? "text-brand" : "text-text-faint")
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-3.5 py-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-brand-strong">
              {user?.name?.[0]?.toUpperCase() ?? "O"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{user?.name}</p>
              <p className="text-xs text-text-muted">{user?.phone} · Owner</p>
            </div>
          </div>

          <button
            onClick={cycleTheme}
            className="flex w-full items-center justify-between rounded-xl border border-border px-3.5 py-3 text-sm font-medium text-text hover:bg-surface-raised"
          >
            <span className="flex items-center gap-2.5">
              <ThemeIcon size={17} className="text-text-muted" /> Appearance
            </span>
            <span className="text-text-muted">{THEME_LABEL[theme]}</span>
          </button>

          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border px-3.5 py-3 text-sm font-medium text-danger hover:bg-danger-soft"
          >
            <LogOut size={17} /> Log out
          </button>

          <p className="pt-2 text-center text-xs text-text-faint">
            Need to manage bookings, customers or settings? Use the full Turf Manager app.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
