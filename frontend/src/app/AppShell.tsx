import { NavLink, Outlet } from "react-router-dom";
import { Calendar, Home, Landmark, Settings2, Users, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Today", icon: Home },
  { to: "/bookings", label: "Bookings", icon: Calendar },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/reports", label: "Reports", icon: Landmark, ownerOnly: true },
];

export function AppShell() {
  const { user, venue, logout } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || user?.role === "owner");

  return (
    <div className="flex min-h-dvh w-full bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface sm:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-contrast">
            {venue?.name?.[0] ?? "T"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{venue?.name ?? "Turf Manager"}</p>
            <p className="text-xs text-text-faint">{user?.role === "owner" ? "Owner" : "Staff"}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-brand-soft text-brand-strong" : "text-text-muted hover:bg-surface-raised hover:text-text",
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          {user?.role === "owner" && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-brand-soft text-brand-strong" : "text-text-muted hover:bg-surface-raised hover:text-text",
                )
              }
            >
              <Settings2 size={18} />
              Settings
            </NavLink>
          )}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{user?.name}</p>
            <button onClick={logout} className="text-xs text-text-faint hover:text-danger">
              Log out
            </button>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header
          className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 sm:hidden"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{venue?.name ?? "Turf Manager"}</p>
            <p className="text-xs text-text-faint">{user?.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user?.role === "owner" && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    isActive ? "bg-brand-soft text-brand-strong" : "text-text-muted hover:bg-surface-raised",
                  )
                }
              >
                <Settings2 size={18} />
              </NavLink>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto pb-24 sm:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur sm:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  isActive ? "text-brand" : "text-text-faint",
                )
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
