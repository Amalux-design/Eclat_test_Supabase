import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLogs } from "../context/LogsContext";
import { CalendarGrid } from "../components/CalendarGrid";
import { DaySheet } from "../components/DaySheet";
import { LogForm } from "../components/LogForm";
import { monthLabel } from "../utils/format";
import type { CalendarData, WorkLog, WorkLogInput } from "../types";

export function CalendarPage() {
  const { loading, error, addLog, editLog, logsByMonth } = useLogs();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [converting, setConverting] = useState<WorkLog | null>(null);
  const [editing, setEditing] = useState<WorkLog | null>(null);

  const calendarData: CalendarData = useMemo(() => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthLogs = logsByMonth.get(key) ?? [];
    const data: CalendarData = {};
    for (const log of monthLogs) {
      if (!data[log.date]) data[log.date] = { status: log.status, logs: [] };
      const entry = data[log.date];
      entry.logs.push(log);
      if (entry.status !== log.status) entry.status = "MIXED";
    }
    return data;
  }, [logsByMonth, year, month]);

  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  function goToMonth(delta: number) {
    setSlideDir(delta > 0 ? "left" : "right");
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // Horizontal swipe to page months. Threshold 45px, and the gesture must be
  // more horizontal than vertical so it doesn't hijack page scrolling.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  function onSwipeStart(x: number, y: number) {
    swipeStart.current = { x, y };
  }

  function onSwipeEnd(x: number, y: number) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    goToMonth(dx < 0 ? 1 : -1);
  }

  const selectedLogs = selectedDate ? calendarData[selectedDate]?.logs ?? [] : [];

  return (
    <div className="page">
      <h1 className="page-title">Calendar</h1>

      {error && <div className="inline-error">{error}</div>}
      {loading && <div className="spinner" />}

      {!loading && (
        <>
          <div
            className="card"
            style={{ marginBottom: 16, overflow: "hidden", touchAction: "pan-y" }}
            onTouchStart={(e) => onSwipeStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={(e) => onSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
            onPointerDown={(e) => e.pointerType === "mouse" && onSwipeStart(e.clientX, e.clientY)}
            onPointerUp={(e) => e.pointerType === "mouse" && onSwipeEnd(e.clientX, e.clientY)}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button className="icon-btn" onClick={() => goToMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={20} />
              </button>
              <div style={{ fontWeight: 700 }}>{monthLabel(year, month)}</div>
              <button className="icon-btn" onClick={() => goToMonth(1)} aria-label="Next month">
                <ChevronRight size={20} />
              </button>
            </div>
            <div
              key={`${year}-${month}`}
              className={slideDir ? `cal-slide-${slideDir}` : undefined}
              onAnimationEnd={() => setSlideDir(null)}
            >
              <CalendarGrid year={year} month={month} data={calendarData} onSelectDate={setSelectedDate} />
            </div>
          </div>

          <div className="legend">
            <span className="legend-item"><span className="legend-dot worked" /> Worked</span>
            <span className="legend-item"><span className="legend-dot reserved" /> Reserved</span>
          </div>
        </>
      )}

      {selectedDate && (
        <DaySheet
          date={selectedDate}
          logs={selectedLogs}
          onClose={() => setSelectedDate(null)}
          onAddWork={() => setAdding(true)}
          onOpenLog={(log) => setEditing(log)}
          onConvertToWorked={(log) => setConverting(log)}
        />
      )}

      {adding && selectedDate && (
        <LogForm
          title="Add Work"
          defaultDate={selectedDate}
          onSubmit={async (input: WorkLogInput) => {
            await addLog(input);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {converting && (
        <LogForm
          title="Mark as Worked"
          initial={converting}
          forceStatus="WORKED"
          onSubmit={async (input: WorkLogInput) => {
            await editLog(converting.id, input);
          }}
          onClose={() => setConverting(null)}
        />
      )}

      {editing && (
        <LogForm
          title="Edit Log"
          initial={editing}
          onSubmit={async (input: WorkLogInput) => {
            await editLog(editing.id, input);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
