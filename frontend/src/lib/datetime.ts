const DEFAULT_TZ = "Asia/Dhaka";

export function formatTime(iso: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).format(
    new Date(iso),
  );
}

export function formatTimeRange(startIso: string, endIso: string, tz: string = DEFAULT_TZ): string {
  return `${formatTime(startIso, tz)} – ${formatTime(endIso, tz)}`;
}

export function formatDayLabel(dateStr: string, tz: string = DEFAULT_TZ): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(d);
}

export function formatShortDay(dateStr: string): { weekday: string; day: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(d),
  };
}

/** YYYY-MM-DD for a Date, in local (browser) time — used for date-picker values. */
export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

export function isToday(dateStr: string): boolean {
  return dateStr === toDateInput(new Date());
}

export function todayStr(): string {
  return toDateInput(new Date());
}

/** Add `minutes` to a "HH:MM" local wall-clock time on `dateStr`, returning a naive
 * "YYYY-MM-DDTHH:MM:SS" string — pure arithmetic, no Date object / timezone involved,
 * so it can't be silently reinterpreted in the browser's own local timezone. */
export function addMinutes(dateStr: string, hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let totalMinutes = h * 60 + m + minutes;
  let dayOffset = 0;
  if (totalMinutes >= 24 * 60) {
    dayOffset = Math.floor(totalMinutes / (24 * 60));
    totalMinutes -= dayOffset * 24 * 60;
  }
  const newH = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const newM = String(totalMinutes % 60).padStart(2, "0");
  const day = dayOffset > 0 ? addDays(dateStr, dayOffset) : dateStr;
  return `${day}T${newH}:${newM}:00`;
}

export function formatDateTimeShort(iso: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(new Date(iso));
}
