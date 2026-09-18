import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/datetime";
import type { Booking, DailyReport, MonthlyReport, OutstandingReport } from "@/lib/types";

export interface Field {
  id: string;
  name: string;
}

export function useFields() {
  return useQuery({ queryKey: ["fields"], queryFn: () => api.get<Field[]>("/fields") });
}

export function useTodayBookings() {
  return useQuery({
    queryKey: ["bookings", "today"],
    queryFn: () => api.get<Booking[]>(`/bookings?date=${todayStr()}`),
    refetchInterval: 60_000,
  });
}

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: ["report", "daily", date],
    queryFn: () => api.get<DailyReport>(`/reports/daily?date=${date}`),
    refetchInterval: 60_000,
  });
}

export function useMonthlyReport(month: string) {
  return useQuery({ queryKey: ["report", "monthly", month], queryFn: () => api.get<MonthlyReport>(`/reports/monthly?month=${month}`) });
}

export function useOutstandingReport() {
  return useQuery({ queryKey: ["report", "outstanding"], queryFn: () => api.get<OutstandingReport>("/reports/outstanding") });
}
