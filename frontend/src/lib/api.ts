import type { ApiErrorBody } from "@/lib/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const ACCESS_KEY = "turf.access_token";
const REFRESH_KEY = "turf.refresh_token";

export class ApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class OfflineError extends ApiError {
  constructor() {
    super("OFFLINE", "No connection — cannot save changes right now.", 0);
  }
}

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Fired when the session is no longer valid, so the app can redirect to /login. */
export const authEvents = new EventTarget();

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh_token = tokenStore.getRefresh();
  if (!refresh_token) return null;

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        tokenStore.set(data.access_token, data.refresh_token);
        return data.access_token as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  idempotencyKey?: string;
  /** Writes must never be silently queued offline — a booking confirmed against stale
   * availability is exactly the double-booking the database is designed to prevent. */
  isWrite?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, idempotencyKey, isWrite, headers, ...rest } = options;

  if (isWrite && !navigator.onLine) {
    throw new OfflineError();
  }

  const doFetch = async (): Promise<Response> => {
    const access = tokenStore.getAccess();
    const finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
    };
    if (access) finalHeaders.Authorization = `Bearer ${access}`;
    if (idempotencyKey) finalHeaders["Idempotency-Key"] = idempotencyKey;

    return fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new OfflineError();
  }

  if (res.status === 401) {
    const parsed = await res.clone().json().catch(() => null);
    if (parsed?.error?.code === "INVALID_TOKEN" && tokenStore.getRefresh()) {
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        res = await doFetch();
      } else {
        tokenStore.clear();
        authEvents.dispatchEvent(new Event("logout"));
        throw new ApiError("INVALID_TOKEN", "Session expired, please log in again.", 401);
      }
    } else {
      tokenStore.clear();
      authEvents.dispatchEvent(new Event("logout"));
    }
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : undefined;

  if (!res.ok) {
    const errBody = data as ApiErrorBody | undefined;
    throw new ApiError(
      errBody?.error?.code ?? "UNKNOWN_ERROR",
      errBody?.error?.message ?? "Something went wrong.",
      res.status,
      errBody?.error?.details ?? {},
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body, isWrite: true }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body, isWrite: true }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE", isWrite: true }),
};
