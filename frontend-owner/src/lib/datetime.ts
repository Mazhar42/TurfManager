const DEFAULT_TZ = "Asia/Dhaka";

export function formatTime(iso: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).format(
    new Date(iso),
  );
}

export function formatTimeRange(startIso: string, endIso: string, tz: string = DEFAULT_TZ): string {
  return `${formatTime(startIso, tz)} – ${formatTime(endIso, tz)}`;
}

export function formatFullDate(dateStr: string, tz: string = DEFAULT_TZ): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(d);
}

export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayStr(): string {
  return toDateInput(new Date());
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
