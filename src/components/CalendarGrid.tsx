import type { CalendarData } from "../types";
import { toISODate, todayISO } from "../utils/format";

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  data: CalendarData;
  onSelectDate: (iso: string) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarGrid({ year, month, data, onSelectDate }: CalendarGridProps) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toISODate(new Date(year, month, d)));
  }

  return (
    <div>
      <div className="calendar-weekdays">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="calendar-weekday">
            {w}
          </div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="calendar-cell empty" />;
          const dayData = data[iso];
          const isToday = iso === today;
          const dayNum = Number(iso.slice(-2));
          let cellClass = "calendar-cell";
          if (dayData?.status === "WORKED") cellClass += " worked";
          else if (dayData?.status === "RESERVED") cellClass += " reserved";
          else if (dayData?.status === "MIXED") cellClass += " mixed";
          if (isToday) cellClass += " today";
          return (
            <button key={iso} className={cellClass} onClick={() => onSelectDate(iso)}>
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
