import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { formatTime, toISODate, todayISO } from "../utils/format";

function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// App-styled replacements for the browser's <select>, date and time inputs.
// Each is a pill field that opens a bottom sheet.

/* ---------- shared sheet ---------- */

interface PickerSheetProps {
  title: string;
  onClose: () => void;
  onDone?: () => void;
  children: ReactNode;
}

function PickerSheet({ title, onClose, onDone, children }: PickerSheetProps) {
  const [closing, setClosing] = useState(false);
  // Read the latest onDone when the close animation ends, so a value picked
  // just before tapping Done is never lost.
  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => {
    onDoneRef.current = onDone;
  });

  function close(commit = false) {
    setClosing(true);
    setTimeout(() => {
      if (commit) onDoneRef.current?.();
      onClose();
    }, 200);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return createPortal(
    <div className={`picker-backdrop ${closing ? "closing" : ""}`} onClick={() => close()}>
      <div className="picker-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <button type="button" className="text-btn" onClick={() => close()}>Cancel</button>
          <h3 className="picker-title">{title}</h3>
          {onDone ? (
            <button type="button" className="save-pill" onClick={() => close(true)}>Done</button>
          ) : (
            <span />
          )}
        </div>
        <div className="picker-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ---------- select ---------- */

interface SelectFieldProps {
  id?: string;
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}

export function SelectField({ id, label, value, options, placeholder = "Not set", onChange }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" id={id} className="field-input picker-field" onClick={() => setOpen(true)}>
        <span className={value ? "" : "picker-placeholder"}>{value || placeholder}</span>
        <ChevronDown size={18} strokeWidth={1.8} />
      </button>
      {open && (
        <PickerSheet title={label} onClose={() => setOpen(false)}>
          <div className="option-list" role="listbox" aria-label={label}>
            {["", ...options].map((opt) => (
              <PickerOption
                key={opt || "none"}
                label={opt || placeholder}
                selected={opt === value}
                onPick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </PickerSheet>
      )}
    </>
  );
}

function PickerOption({ label, selected, onPick }: { label: string; selected: boolean; onPick: () => void }) {
  return (
    <button type="button" role="option" aria-selected={selected} className={`option ${selected ? "selected" : ""}`} onClick={onPick}>
      <span>{label}</span>
      {selected && <Check size={18} strokeWidth={2.2} />}
    </button>
  );
}

/* ---------- date ---------- */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface DateFieldProps {
  id?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

export function DateField({ id, value, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" id={id} className="field-input picker-field" onClick={() => setOpen(true)}>
        <span>{value ? shortDate(value) : "Choose a date"}</span>
        <Calendar size={17} strokeWidth={1.7} />
      </button>
      {open && <DateSheet value={value} onClose={() => setOpen(false)} onChange={onChange} />}
    </>
  );
}

function DateSheet({ value, onClose, onChange }: { value: string; onClose: () => void; onChange: (v: string) => void }) {
  const initial = new Date((value || todayISO()) + "T00:00:00");
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [picked, setPicked] = useState(value || todayISO());
  const today = todayISO();

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(offset).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(toISODate(new Date(year, month, d)));
  const monthName = new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <PickerSheet title="Date" onClose={onClose} onDone={() => onChange(picked)}>
      <div className="date-sheet-nav">
        <span className="date-sheet-month">{monthName}</span>
        <span className="date-sheet-arrows">
          <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight size={22} strokeWidth={2} />
          </button>
        </span>
      </div>
      <div key={`${year}-${month}`} className="date-grid">
        {WEEKDAYS.map((w, i) => (
          <span key={`w${i}`} className="date-weekday">{w}</span>
        ))}
        {cells.map((iso, i) =>
          iso ? (
            <button
              type="button"
              key={iso}
              className={`date-cell ${iso === picked ? "selected" : ""} ${iso === today ? "today" : ""}`}
              onClick={() => setPicked(iso)}
              aria-pressed={iso === picked}
            >
              {Number(iso.slice(-2))}
            </button>
          ) : (
            <span key={`e${i}`} />
          )
        )}
      </div>
    </PickerSheet>
  );
}

/* ---------- time ---------- */

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

interface TimeFieldProps {
  id?: string;
  label: string;
  value: string; // "HH:mm" or ""
  onChange: (value: string) => void;
}

export function TimeField({ id, label, value, onChange }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="time-field-row">
        <button type="button" id={id} className="field-input picker-field" onClick={() => setOpen(true)}>
          <span className={value ? "" : "picker-placeholder"}>{value ? formatTime(value) : "Not set"}</span>
          <Clock size={17} strokeWidth={1.7} />
        </button>
        {value && (
          <button type="button" className="picker-clear" onClick={() => onChange("")} aria-label={`Clear ${label.toLowerCase()}`}>
            <X size={14} strokeWidth={2.2} />
          </button>
        )}
      </div>
      {open && <TimeSheet label={label} value={value} onClose={() => setOpen(false)} onChange={onChange} />}
    </>
  );
}

function TimeSheet({ label, value, onClose, onChange }: { label: string; value: string; onClose: () => void; onChange: (v: string) => void }) {
  const [h0, m0] = (value || "09:00").split(":").map(Number);
  const [hour, setHour] = useState(h0 % 12 === 0 ? 12 : h0 % 12);
  const [minute, setMinute] = useState(m0 - (m0 % 5));
  const [pm, setPm] = useState(h0 >= 12);

  function done() {
    const h = (hour % 12) + (pm ? 12 : 0);
    onChange(`${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  return (
    <PickerSheet title={label} onClose={onClose} onDone={done}>
      <div className="time-preview">
        {hour}:{String(minute).padStart(2, "0")} {pm ? "pm" : "am"}
      </div>
      <div className="segmented time-ampm">
        <button type="button" className={`segmented-btn ${!pm ? "active" : ""}`} onClick={() => setPm(false)}>am</button>
        <button type="button" className={`segmented-btn ${pm ? "active" : ""}`} onClick={() => setPm(true)}>pm</button>
      </div>
      <div className="time-group-label">Hour</div>
      <div className="time-grid">
        {HOURS.map((h) => (
          <button type="button" key={h} className={`time-chip ${h === hour ? "selected" : ""}`} onClick={() => setHour(h)}>
            {h}
          </button>
        ))}
      </div>
      <div className="time-group-label">Minute</div>
      <div className="time-grid">
        {MINUTES.map((m) => (
          <button type="button" key={m} className={`time-chip ${m === minute ? "selected" : ""}`} onClick={() => setMinute(m)}>
            :{String(m).padStart(2, "0")}
          </button>
        ))}
      </div>
    </PickerSheet>
  );
}
