import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api, authEvents, tokenStore } from "@/lib/api";
import type { CurrentUser, Venue } from "@/lib/types";

/** Drop everything the previous user could see — the in-memory query cache and the
 * service worker's offline copy of recent reads — so a shared front-desk phone never
 * shows one login's data to the next. */
function clearSessionData(queryClient: QueryClient) {
  queryClient.clear();
  if ("caches" in window) void caches.delete("turf-reads").catch(() => {});
}

interface AuthContextValue {
  user: CurrentUser | null;
  venue: Venue | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refreshVenue: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "anonymous">("loading");
  const queryClient = useQueryClient();

  const loadSession = useCallback(async () => {
    if (!tokenStore.getAccess()) {
      setStatus("anonymous");
      return;
    }
    try {
      const [me, v] = await Promise.all([
        api.get<CurrentUser>("/auth/me"),
        api.get<Venue>("/settings/venue"),
      ]);
      setUser(me);
      setVenue(v);
      setStatus("authenticated");
    } catch {
      tokenStore.clear();
      setUser(null);
      setVenue(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void loadSession();
    const onLogout = () => {
      clearSessionData(queryClient);
      setUser(null);
      setVenue(null);
      setStatus("anonymous");
    };
    authEvents.addEventListener("logout", onLogout);
    return () => authEvents.removeEventListener("logout", onLogout);
  }, [loadSession, queryClient]);

  const login = useCallback(
    async (phone: string, password: string) => {
      const tokens = await api.post<{ access_token: string; refresh_token: string }>(
        "/auth/login",
        { phone, password },
      );
      tokenStore.set(tokens.access_token, tokens.refresh_token);
      await loadSession();
    },
    [loadSession],
  );

  const logout = useCallback(() => {
    const refresh_token = tokenStore.getRefresh();
    tokenStore.clear();
    clearSessionData(queryClient);
    setUser(null);
    setVenue(null);
    setStatus("anonymous");
    if (refresh_token) {
      void api.post("/auth/logout", { refresh_token }).catch(() => {});
    }
  }, [queryClient]);

  const refreshVenue = useCallback(async () => {
    const v = await api.get<Venue>("/settings/venue");
    setVenue(v);
  }, []);

  return (
    <AuthContext.Provider value={{ user, venue, status, login, logout, refreshVenue }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
