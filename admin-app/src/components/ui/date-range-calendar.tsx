"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: { day: number; dateStr: string; inMonth: boolean }[] = [];

  for (let i = offset - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ day: d, dateStr: toDateStr(py, pm, d), inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d), inMonth: true });
  }

  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ day: d, dateStr: toDateStr(ny, nm, d), inMonth: false });
  }

  return cells;
}

function MonthGrid({
  year,
  month,
  from,
  to,
  hovered,
  onSelect,
  onHover,
}: {
  year: number;
  month: number;
  from: string | null;
  to: string | null;
  hovered: string | null;
  onSelect: (dateStr: string) => void;
  onHover: (dateStr: string | null) => void;
}) {
  const cells = useMemo(() => getMonthDays(year, month), [year, month]);

  const rangeEnd = to || hovered;

  function isInRange(dateStr: string) {
    if (!from || !rangeEnd) return false;
    const [a, b] = from <= rangeEnd ? [from, rangeEnd] : [rangeEnd, from];
    return dateStr >= a && dateStr <= b;
  }

  function isStart(dateStr: string) { return dateStr === from; }
  function isEnd(dateStr: string) { return dateStr === (to || hovered); }

  return (
    <div className="w-[252px]">
      <div className="text-center font-mono text-[12px] font-semibold text-foreground mb-3">
        {MONTHS[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {DAYS.map((d) => (
          <div key={d} className="flex items-center justify-center h-8 font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/30">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          const inRange = isInRange(cell.dateStr);
          const start = isStart(cell.dateStr);
          const end = isEnd(cell.dateStr);
          const selected = start || end;

          return (
            <div
              key={i}
              className={cn("relative flex items-center justify-center h-8", inRange && !selected && "bg-[#3D5A80]/10")}
            >
              {inRange && start && <div className="absolute inset-y-0 right-0 w-1/2 bg-[#3D5A80]/10" />}
              {inRange && end && <div className="absolute inset-y-0 left-0 w-1/2 bg-[#3D5A80]/10" />}
              <button
                onClick={() => cell.inMonth && onSelect(cell.dateStr)}
                onMouseEnter={() => cell.inMonth && onHover(cell.dateStr)}
                onMouseLeave={() => onHover(null)}
                disabled={!cell.inMonth}
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full font-mono text-[11px] transition-colors",
                  !cell.inMonth && "text-muted-foreground/10 cursor-default",
                  cell.inMonth && !selected && !inRange && "text-muted-foreground/60 hover:bg-[#3D5A80]/20 hover:text-foreground",
                  cell.inMonth && inRange && !selected && "text-foreground",
                  selected && "bg-[#3D5A80] text-white font-semibold",
                )}
              >
                {cell.day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This year", days: -1 },
] as const;

function presetRange(preset: typeof PRESETS[number]): { from: string; to: string } {
  const now = new Date();
  const to = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset.days === 0) return { from: to, to };
  if (preset.days === -1) return { from: `${now.getFullYear()}-01-01`, to };
  const d = new Date();
  d.setDate(d.getDate() - preset.days);
  return { from: toDateStr(d.getFullYear(), d.getMonth(), d.getDate()), to };
}

export function DateRangeCalendar({
  from,
  to,
  onChange,
}: {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}) {
  const now = new Date();
  const [baseMonth, setBaseMonth] = useState(to ? new Date(to + "T00:00:00").getMonth() : now.getMonth());
  const [baseYear, setBaseYear] = useState(to ? new Date(to + "T00:00:00").getFullYear() : now.getFullYear());
  const [hovered, setHovered] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<"from" | "to">(from && !to ? "to" : "from");

  const prevMonth = baseMonth === 0 ? 11 : baseMonth - 1;
  const prevYear = baseMonth === 0 ? baseYear - 1 : baseYear;

  function goBack() {
    if (baseMonth === 0) { setBaseMonth(11); setBaseYear(baseYear - 1); }
    else setBaseMonth(baseMonth - 1);
  }

  function goForward() {
    if (baseMonth === 11) { setBaseMonth(0); setBaseYear(baseYear + 1); }
    else setBaseMonth(baseMonth + 1);
  }

  function handleSelect(dateStr: string) {
    if (selecting === "from") {
      onChange(dateStr, null);
      setSelecting("to");
    } else {
      if (from && dateStr < from) {
        onChange(dateStr, null);
        setSelecting("to");
      } else {
        onChange(from, dateStr);
        setSelecting("from");
      }
    }
  }

  return (
    <div className="flex gap-4">
      {/* Presets */}
      <div className="flex flex-col gap-0.5 border-r border-[#1F1F1F] pr-4 pt-6">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              const r = presetRange(p);
              onChange(r.from, r.to);
              setSelecting("from");
            }}
            className="rounded-md px-3 py-1.5 text-left font-mono text-[11px] text-muted-foreground/50 hover:bg-[#3D5A80]/10 hover:text-foreground transition-colors whitespace-nowrap"
          >
            {p.label}
          </button>
        ))}
        {(from || to) && (
          <button
            onClick={() => { onChange(null, null); setSelecting("from"); }}
            className="mt-2 rounded-md px-3 py-1.5 text-left font-mono text-[10px] text-destructive hover:bg-destructive/10 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Calendars */}
      <div className="flex gap-4">
        <div className="relative">
          <button onClick={goBack} className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.04] transition-colors">
            <ChevronLeft className="size-4" />
          </button>
          <MonthGrid year={prevYear} month={prevMonth} from={from} to={to} hovered={from && !to ? hovered : null} onSelect={handleSelect} onHover={setHovered} />
        </div>
        <div className="relative">
          <button onClick={goForward} className="absolute right-0 top-0 flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.04] transition-colors">
            <ChevronRight className="size-4" />
          </button>
          <MonthGrid year={baseYear} month={baseMonth} from={from} to={to} hovered={from && !to ? hovered : null} onSelect={handleSelect} onHover={setHovered} />
        </div>
      </div>
    </div>
  );
}
