import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/app/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { TodayPage } from "@/features/today/TodayPage";
import { BookingsPage } from "@/features/bookings/BookingsPage";
import { BookingDetailPage } from "@/features/bookings/BookingDetailPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { CustomerDetailPage } from "@/features/customers/CustomerDetailPage";
import { PaymentsPage } from "@/features/payments/PaymentsPage";
import { Spinner } from "@/components/ui/Skeleton";
import type { ReactNode } from "react";

// Owner-only and chart-heavy (Recharts) — split out of the critical Today-screen bundle.
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});

function FullScreenLoader() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-bg text-brand">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullScreenLoader />;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOwner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== "owner") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { status } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={status === "authenticated" ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<TodayPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route
          path="/reports"
          element={
            <RequireOwner>
              <Suspense fallback={<FullScreenLoader />}>
                <ReportsPage />
              </Suspense>
            </RequireOwner>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireOwner>
              <Suspense fallback={<FullScreenLoader />}>
                <SettingsPage />
              </Suspense>
            </RequireOwner>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
