import type { CalendarData } from "../types";
import { toISODate, todayISO } from "../utils/format";

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  data: CalendarData;
  selected: string | null;
  onSelectDate: (iso: string) => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarGrid({ year, month, data, selected, onSelectDate }: CalendarGridProps) {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month, d)));

  return (
    <div className="calendar">
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className={`calendar-weekday ${i >= 5 ? "weekend" : ""}`}>{w}</div>
        ))}
      </div>
      <div className="calendar-grid" role="grid">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} className="calendar-cell empty" />;
          const logs = data[iso]?.logs ?? [];
          const booked = logs.filter((l) => l.status === "RESERVED").length;
          const done = logs.length - booked;
          const classes = ["calendar-cell"];
          if (iso === today) classes.push("today");
          if (iso === selected) classes.push("selected");
          if (iso < today) classes.push("past");
          const label = `${new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}${
            logs.length ? `, ${logs.length} booking${logs.length > 1 ? "s" : ""}` : ", free"
          }`;
          return (
            <button
              key={iso}
              className={classes.join(" ")}
              onClick={() => onSelectDate(iso)}
              aria-label={label}
              aria-pressed={iso === selected}
            >
              <span className="calendar-num">{Number(iso.slice(-2))}</span>
              <span className="calendar-dots" aria-hidden="true">
                {Array.from({ length: Math.min(booked, 3) }, (_, k) => (
                  <span key={`b${k}`} className="dot reserved" />
                ))}
                {Array.from({ length: Math.min(done, 3 - Math.min(booked, 3)) }, (_, k) => (
                  <span key={`d${k}`} className="dot worked" />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
