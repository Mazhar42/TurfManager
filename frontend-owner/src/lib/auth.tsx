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
  if ("caches" in window) void caches.delete("owner-reads").catch(() => {});
}

interface AuthContextValue {
  user: CurrentUser | null;
  venue: Venue | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
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
      const [me, v] = await Promise.all([api.get<CurrentUser>("/auth/me"), api.get<Venue>("/settings/venue")]);
      if (me.role !== "owner") {
        // This companion app is for owners/managers only — the full staff app is separate.
        tokenStore.clear();
        setUser(null);
        setVenue(null);
        setStatus("anonymous");
        return;
      }
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
      const tokens = await api.post<{ access_token: string; refresh_token: string }>("/auth/login", { phone, password });
      tokenStore.set(tokens.access_token, tokens.refresh_token);
      await loadSession();
      // If loadSession found a non-owner account, it already cleared the tokens.
      if (!tokenStore.getAccess()) {
        throw new Error("This app is for owners and managers. Ask the owner to set up your access, or use the staff app.");
      }
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
    if (refresh_token) void api.post("/auth/logout", { refresh_token }).catch(() => {});
  }, [queryClient]);

  return <AuthContext.Provider value={{ user, venue, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
