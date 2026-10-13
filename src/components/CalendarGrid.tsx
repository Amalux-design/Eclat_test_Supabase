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

/** Week rows (Mon–Sun) for a month, padded with nulls. */
function monthWeeks(year: number, month: number): (string | null)[][] {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function CalendarGrid({ year, month, data, selected, onSelectDate }: CalendarGridProps) {
  const today = todayISO();
  const weeks = monthWeeks(year, month);
  // The row that stays visible when the calendar folds to a single week.
  const selectedWeek = weeks.findIndex((w) => w.includes(selected));
  const todayWeek = weeks.findIndex((w) => w.includes(today));
  const focusIndex = selectedWeek >= 0 ? selectedWeek : todayWeek >= 0 ? todayWeek : 0;

  return (
    <div className="calendar">
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className={`calendar-weekday ${i >= 5 ? "weekend" : ""}`}>{w}</div>
        ))}
      </div>
      <div className="calendar-grid" role="grid">
        {weeks.map((week, wi) => (
          <div key={wi} className={`cal-week ${wi === focusIndex ? "is-focus" : ""}`} role="row">
            <div className="cal-week-inner">
              {week.map((iso, i) => {
                if (!iso) return <div key={`e${i}`} className="calendar-cell empty" />;
                const logs = data[iso]?.logs ?? [];
                const booked = logs.filter((l) => l.status === "RESERVED").length;
                const done = logs.length - booked;
                const classes = ["calendar-cell"];
                if (iso === today) classes.push("today");
                if (iso === selected) classes.push("selected");
                if (iso < today) classes.push("past");
                const label = `${new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}${logs.length ? `, ${logs.length} booking${logs.length > 1 ? "s" : ""}` : ", free"}`;
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
        ))}
      </div>
    </div>
  );
}
