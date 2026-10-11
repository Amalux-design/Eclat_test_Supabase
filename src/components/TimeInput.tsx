interface TimeInputProps {
  value: string; // "HH:mm" 24-hour, "" allowed
  onChange: (value: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

function parse(value: string): { hour12: number; minute: number; period: "AM" | "PM" } | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, period };
}

function toValue(hour12: number, minute: number, period: "AM" | "PM"): string {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimeInput({ value, onChange }: TimeInputProps) {
  const parsed = parse(value);
  const hour12 = parsed?.hour12 ?? 9;
  const minute = parsed?.minute ?? 0;
  const period = parsed?.period ?? "AM";

  function update(next: Partial<{ hour12: number; minute: number; period: "AM" | "PM" }>) {
    onChange(
      toValue(next.hour12 ?? hour12, next.minute ?? minute, next.period ?? period)
    );
  }

  return (
    <div className="time-input">
      <select
        className="field-input time-select"
        value={parsed ? hour12 : ""}
        onChange={(e) => update({ hour12: Number(e.target.value) })}
      >
        {!parsed && <option value="">--</option>}
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="time-colon">:</span>
      <select
        className="field-input time-select"
        value={parsed ? minute : ""}
        onChange={(e) => update({ minute: Number(e.target.value) })}
      >
        {!parsed && <option value="">--</option>}
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <div className="segmented time-period">
        <button
          type="button"
          className={`segmented-btn ${period === "AM" ? "active" : ""}`}
          onClick={() => update({ period: "AM" })}
        >
          AM
        </button>
        <button
          type="button"
          className={`segmented-btn ${period === "PM" ? "active" : ""}`}
          onClick={() => update({ period: "PM" })}
        >
          PM
        </button>
      </div>
      {value && (
        <button type="button" className="time-clear" onClick={() => onChange("")} aria-label="Clear time">
          ×
        </button>
      )}
    </div>
  );
}
