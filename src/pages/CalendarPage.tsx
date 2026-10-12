import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useLogs } from "../context/LogsContext";
import { useAuth } from "../context/AuthContext";
import { CalendarGrid } from "../components/CalendarGrid";
import { LogCard } from "../components/LogCard";
import { LogForm } from "../components/LogForm";
import { Loader } from "../components/Loader";
import { formatDateLong, todayISO } from "../utils/format";
import type { CalendarData, WorkLog, WorkLogInput } from "../types";

function byTime(a: WorkLog, b: WorkLog) {
  return (a.startTime || "99").localeCompare(b.startTime || "99");
}

export function CalendarPage() {
  const { loading, error, addLog, editLog, logsByMonth, logsByDate } = useLogs();
  const { isAdmin } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [adding, setAdding] = useState(false);
  const [converting, setConverting] = useState<WorkLog | null>(null);
  const [editing, setEditing] = useState<WorkLog | null>(null);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  const monthLogs = useMemo(
    () => logsByMonth.get(`${year}-${String(month + 1).padStart(2, "0")}`) ?? [],
    [logsByMonth, year, month]
  );

  const calendarData: CalendarData = useMemo(() => {
    const data: CalendarData = {};
    for (const log of monthLogs) {
      if (!data[log.date]) data[log.date] = { status: log.status, logs: [] };
      const entry = data[log.date];
      entry.logs.push(log);
      if (entry.status !== log.status) entry.status = "MIXED";
    }
    return data;
  }, [monthLogs]);

  function goToMonth(delta: number) {
    setSlideDir(delta > 0 ? "left" : "right");
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function goToToday() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setSelectedDate(todayISO());
  }

  // Horizontal swipe pages months; must be more horizontal than vertical.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function onSwipeEnd(x: number, y: number) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    goToMonth(dx < 0 ? 1 : -1);
  }

  const dayLogs = [...(logsByDate.get(selectedDate) ?? [])].sort(byTime);
  const monthName = new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long" });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const booked = monthLogs.filter((l) => l.status === "RESERVED").length;

  return (
    <div className="page">
      {error && <div className="inline-note">{error}</div>}

      <div
        className="calendar-card"
        onTouchStart={(e) => (swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => onSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
      >
      <div className="cal-head">
        <h1 className="large-title cal-title">
          {monthName} <span className="cal-year">{year}</span>
        </h1>
        <div className="cal-head-actions">
          <button className="icon-btn" onClick={() => goToMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
          <button className="icon-btn" onClick={() => goToMonth(1)} aria-label="Next month">
            <ChevronRight size={24} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="cal-sub">
        <p className="subtitle">
          {monthLogs.length === 0
            ? "No bookings this month"
            : `${monthLogs.length} booking${monthLogs.length > 1 ? "s" : ""}, ${booked} still to do`}
        </p>
        {!isCurrentMonth && (
          <button className="today-btn" onClick={goToToday}>Today</button>
        )}
      </div>

        <div key={`${year}-${month}`} className={slideDir ? `cal-slide-${slideDir}` : undefined} onAnimationEnd={() => setSlideDir(null)}>
          <CalendarGrid year={year} month={month} data={calendarData} selected={selectedDate} onSelectDate={setSelectedDate} />
        </div>
        <div className="legend">
          <span className="legend-item"><span className="dot reserved" /> Booked</span>
          <span className="legend-item"><span className="dot worked" /> Done</span>
        </div>
      </div>

      <section key={selectedDate} className="agenda" aria-live="polite">
        <header className="agenda-head">
          <h2 className="agenda-title">{selectedDate === todayISO() ? "Today" : formatDateLong(selectedDate)}</h2>
          {isAdmin ? (
            <button className="agenda-add" onClick={() => setAdding(true)}>
              <Plus size={16} strokeWidth={2.2} /> Add
            </button>
          ) : (
            <span className="agenda-count">
              {dayLogs.length ? `${dayLogs.length} booking${dayLogs.length > 1 ? "s" : ""}` : ""}
            </span>
          )}
        </header>

        {loading && <Loader label="Loading bookings" />}

        {!loading && dayLogs.length === 0 && (
          <p className="agenda-empty">Nothing booked on this day.</p>
        )}

        {!loading && dayLogs.length > 0 && (
          <div className="list">
            {dayLogs.map((log) => (
              <div key={log.id}>
                <LogCard log={log} onClick={isAdmin ? () => setEditing(log) : undefined} />
                {isAdmin && log.status === "RESERVED" && selectedDate <= todayISO() && (
                  <button className="row-action" onClick={() => setConverting(log)}>Mark as done</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {adding && (
        <LogForm
          title="New booking"
          defaultDate={selectedDate}
          onSubmit={(input: WorkLogInput) => addLog(input)}
          onClose={() => setAdding(false)}
        />
      )}

      {converting && (
        <LogForm
          title="Mark as done"
          initial={converting}
          forceStatus="WORKED"
          onSubmit={(input: WorkLogInput) => editLog(converting.id, input)}
          onClose={() => setConverting(null)}
        />
      )}

      {editing && (
        <LogForm
          title="Edit booking"
          initial={editing}
          onSubmit={(input: WorkLogInput) => editLog(editing.id, input)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
