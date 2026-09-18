import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { addDays, formatShortDay, isToday, todayStr } from "@/lib/datetime";

const RANGE_BEFORE = 3;
const RANGE_AFTER = 21;

export function DateStrip({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const today = todayStr();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const dates = Array.from({ length: RANGE_BEFORE + RANGE_AFTER + 1 }, (_, i) => addDays(today, i - RANGE_BEFORE));

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
      <div ref={scrollerRef} className="scroll-thin flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1">
        {dates.map((d) => {
          const { weekday, day } = formatShortDay(d);
          const active = d === value;
          return (
            <button
              key={d}
              ref={active ? activeRef : undefined}
              onClick={() => onChange(d)}
              className={cn(
                "flex min-w-13 shrink-0 flex-col items-center rounded-xl px-2.5 py-1.5 transition-colors",
                active ? "bg-brand text-brand-contrast" : "text-text-muted hover:bg-surface-raised",
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{weekday}</span>
              <span className="text-base font-semibold tabular">{day}</span>
              {isToday(d) && (
                <span className={cn("mt-0.5 h-1 w-1 rounded-full", active ? "bg-brand-contrast" : "bg-brand")} />
              )}
            </button>
          );
        })}
      </div>
      {value !== today && (
        <button
          onClick={() => onChange(today)}
          className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text"
        >
          Today
        </button>
      )}
    </div>
  );
}
