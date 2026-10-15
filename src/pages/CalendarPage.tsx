import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);
  const [titleDir, setTitleDir] = useState<"next" | "prev" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);

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

  function shiftMonth(delta: number) {
    setTitleDir(delta > 0 ? "next" : "prev");
    setYear((y) => new Date(y, month + delta, 1).getFullYear());
    setMonth((m) => new Date(year, m + delta, 1).getMonth());
  }

  const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

  /** Slide the current month out, swap, slide the next one in from the other side. */
  function goToMonth(delta: number, fromX = 0) {
    const track = trackRef.current;
    if (!track || animating.current || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (!animating.current) shiftMonth(delta);
      return;
    }
    animating.current = true;
    const w = track.offsetWidth;
    track.style.transition = `transform 0.26s ${EASE}, opacity 0.26s ease`;
    // Continue from wherever the finger let go.
    track.style.transform = `translate3d(${fromX - delta * w * 0.4}px,0,0)`;
    track.style.opacity = "0";
    window.setTimeout(() => {
      shiftMonth(delta);
      track.style.transition = "none";
      track.style.transform = `translate3d(${delta * w * 0.4}px,0,0)`;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          track.style.transition = `transform 0.42s ${EASE}, opacity 0.3s ease`;
          track.style.transform = "translate3d(0,0,0)";
          track.style.opacity = "1";
        })
      );
    }, 240);
    // Unlock on a timer, not a frame callback, so a paused tab can't jam swipes.
    window.setTimeout(() => (animating.current = false), 680);
  }

  // Month follows the finger. Vertical gestures stay native scroll
  // (touch-action: pan-y); only clearly horizontal drags are taken over.
  const drag = useRef<{ x: number; y: number; t: number; dx: number; lock: "x" | "y" | null } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (animating.current || e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, lock: null };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.lock) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.lock = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.lock === "x") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (d.lock !== "x") return;
    d.dx = dx;
    track.style.transition = "none";
    track.style.transform = `translate3d(${dx}px,0,0)`;
    track.style.opacity = String(1 - Math.min(Math.abs(dx) / track.offsetWidth, 1) * 0.5);
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    const track = trackRef.current;
    if (!d || d.lock !== "x" || !track) return;
    const velocity = d.dx / Math.max(performance.now() - d.t, 1); // px per ms
    const passed = Math.abs(d.dx) > track.offsetWidth * 0.25 || Math.abs(velocity) > 0.45;
    if (passed) {
      goToMonth(d.dx < 0 ? 1 : -1, d.dx);
    } else {
      track.style.transition = `transform 0.45s ${EASE}, opacity 0.3s ease`;
      track.style.transform = "translate3d(0,0,0)";
      track.style.opacity = "1";
    }
  }

  // When the month changes, the card resizes to the new number of week rows
  // (4–6). Animate from the old height to the new one instead of jumping.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const from = lastHeight.current;
    card.style.height = "";
    const to = card.offsetHeight;
    lastHeight.current = to;
    if (!from || from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    card.style.height = `${from}px`;
    void card.offsetHeight; // commit the start height before transitioning
    card.style.transition = "height 0.5s cubic-bezier(0.32, 0.72, 0, 1)";
    card.style.height = `${to}px`;
    const done = () => {
      card.style.height = "";
      card.style.transition = "";
      card.removeEventListener("transitionend", done);
    };
    card.addEventListener("transitionend", done);
    const fallback = window.setTimeout(done, 650);
    return () => window.clearTimeout(fallback);
  }, [year, month]);


  function goToToday() {
    const t = new Date();
    setTitleDir(t.getFullYear() * 12 + t.getMonth() > year * 12 + month ? "next" : "prev");
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setSelectedDate(todayISO());
  }

  const dayLogs = [...(logsByDate.get(selectedDate) ?? [])].sort(byTime);
  const monthName = new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long" });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const booked = monthLogs.filter((l) => l.status === "RESERVED").length;

  return (
    <div className="page calendar-page">
      {error && <div className="inline-note">{error}</div>}

      <div ref={cardRef} className="calendar-card">
      <div className="cal-head">
        <h1 className="large-title cal-title" aria-live="polite">
          <span key={`${year}-${month}`} className={`cal-title-text ${titleDir ? `from-${titleDir}` : ""}`}>
            {monthName} <span className="cal-year">{year}</span>
          </span>
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

        <div
          ref={trackRef}
          className="cal-track"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
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
                <LogCard log={log} onEdit={isAdmin ? () => setEditing(log) : undefined} />
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
          onSubmit={(input: WorkLogInput, photos) => addLog(input, photos)}
          onClose={() => setAdding(false)}
        />
      )}

      {converting && (
        <LogForm
          title="Mark as done"
          initial={converting}
          forceStatus="WORKED"
          onSubmit={(input: WorkLogInput, photos) => editLog(converting.id, input, photos)}
          onClose={() => setConverting(null)}
        />
      )}

      {editing && (
        <LogForm
          title="Edit booking"
          initial={editing}
          onSubmit={(input: WorkLogInput, photos) => editLog(editing.id, input, photos)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
