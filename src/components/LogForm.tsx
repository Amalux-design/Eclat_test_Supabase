import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { PaymentStatus, WorkLog, WorkLogInput, WorkStatus } from "../types";
import { isPastOrToday, joinWorks, parseWorks, todayISO } from "../utils/format";
import { TimeInput } from "./TimeInput";

interface LogFormProps {
  initial?: WorkLog | null;
  defaultDate?: string;
  forceStatus?: WorkStatus;
  title: string;
  onSubmit: (input: WorkLogInput) => Promise<void>;
  onClose: () => void;
}

const EVENT_TYPES = ["", "Bridal", "Bridal Party", "Photoshoot", "Party", "Gala", "Other"];
const WORK_TYPES = [
  "Saree Draping",
  "Hair Style",
  "Makeup",
  "Saree Pre Pleating",
  "Assisting",
  "Travel",
  "Shop Work",
];

export function LogForm({ initial, defaultDate, forceStatus, title, onSubmit, onClose }: LogFormProps) {
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayISO());
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? "");
  // `work` is edited here as a list and serialized to a comma-delimited string
  // on submit (see joinWorks). Pre-defined types plus any custom entries the
  // log already had are all just chips.
  const [selectedWorks, setSelectedWorks] = useState<string[]>(parseWorks(initial?.work ?? ""));
  const [customWork, setCustomWork] = useState("");

  const chipOptions = Array.from(new Set([...WORK_TYPES, ...selectedWorks]));

  function toggleWork(w: string) {
    setSelectedWorks((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }

  function addCustomWork() {
    const w = customWork.replace(/,/g, "").trim();
    if (!w) return;
    setSelectedWorks((prev) => (prev.includes(w) ? prev : [...prev, w]));
    setCustomWork("");
  }
  const [eventType, setEventType] = useState(initial?.eventType ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [qty, setQty] = useState(initial ? String(initial.qty) : "1");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [amountTouched, setAmountTouched] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initial?.paymentStatus ?? "PENDING");
  const [own, setOwn] = useState(initial?.own ?? true);
  const [referrerName, setReferrerName] = useState(initial?.referrerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [statusOverride, setStatusOverride] = useState<WorkStatus | null>(initial?.status ?? forceStatus ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (amountTouched) return;
    const q = Number(qty) || 0;
    const p = Number(price) || 0;
    if (q && p) setAmount(String(q * p));
  }, [qty, price, amountTouched]);

  const autoStatus: WorkStatus = isPastOrToday(date) ? "WORKED" : "RESERVED";
  const effectiveStatus = forceStatus ?? statusOverride ?? autoStatus;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const workValue = joinWorks(selectedWorks);
    if (!workValue || !date) {
      setError("Please select at least one work and a date.");
      return;
    }
    if (!own && !referrerName.trim()) {
      setError("Please enter who referred this work.");
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        date,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        work: workValue,
        eventType,
        qty: Number(qty) || 1,
        price: Number(price) || amountNum,
        startTime,
        endTime,
        amount: amountNum,
        paymentStatus,
        status: effectiveStatus,
        own,
        referrerName: own ? "" : referrerName.trim(),
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="inline-error">{error}</div>}

          <label className="field-label">Date</label>
          <input
            type="date"
            className="field-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <label className="field-label">Client name (optional)</label>
          <input
            type="text"
            className="field-input"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Sarah Nguyen"
          />

          <label className="field-label">Client contact number (optional)</label>
          <input
            type="tel"
            className="field-input"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
          />

          <label className="field-label">Work (select one or more)</label>
          <div className="work-chips">
            {chipOptions.map((w) => (
              <button
                key={w}
                type="button"
                className={`work-chip ${selectedWorks.includes(w) ? "active" : ""}`}
                onClick={() => toggleWork(w)}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="work-custom-row">
            <input
              type="text"
              className="field-input"
              value={customWork}
              onChange={(e) => setCustomWork(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomWork();
                }
              }}
              placeholder="Add another, e.g. Nail Art"
            />
            <button type="button" className="segmented-btn work-add-btn" onClick={addCustomWork}>
              Add
            </button>
          </div>

          <label className="field-label">Event type (optional)</label>
          <select className="field-input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || "None"}
              </option>
            ))}
          </select>

          <label className="field-label">Start time (optional)</label>
          <TimeInput value={startTime} onChange={setStartTime} />

          <label className="field-label">End time (optional)</label>
          <TimeInput value={endTime} onChange={setEndTime} />

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Qty</label>
              <input
                type="number"
                min="1"
                step="1"
                className="field-input"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="field-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="per unit"
              />
            </div>
          </div>

          <label className="field-label">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="field-input"
            value={amount}
            onChange={(e) => {
              setAmountTouched(true);
              setAmount(e.target.value);
            }}
            placeholder="0"
            required
          />

          <label className="field-label">Work type</label>
          <div className="segmented">
            <button
              type="button"
              className={`segmented-btn ${own ? "active" : ""}`}
              onClick={() => setOwn(true)}
            >
              Direct
            </button>
            <button
              type="button"
              className={`segmented-btn ${!own ? "active" : ""}`}
              onClick={() => setOwn(false)}
            >
              Referred
            </button>
          </div>

          <div className={`reveal-field ${!own ? "open" : ""}`}>
            <div className="reveal-field-inner">
              <label className="field-label">Referred by</label>
              <input
                type="text"
                className="field-input"
                value={referrerName}
                onChange={(e) => setReferrerName(e.target.value)}
                placeholder="e.g. Meera (event planner)"
                required={!own}
              />
            </div>
          </div>

          <label className="field-label">Payment status</label>
          <div className="segmented">
            <button
              type="button"
              className={`segmented-btn ${paymentStatus === "PAID" ? "active" : ""}`}
              onClick={() => setPaymentStatus("PAID")}
            >
              Paid
            </button>
            <button
              type="button"
              className={`segmented-btn ${paymentStatus === "PENDING" ? "active" : ""}`}
              onClick={() => setPaymentStatus("PENDING")}
            >
              Pending
            </button>
          </div>

          {!forceStatus && (
            <>
              <label className="field-label">Status</label>
              <div className="segmented">
                <button
                  type="button"
                  className={`segmented-btn ${effectiveStatus === "WORKED" ? "active" : ""}`}
                  onClick={() => setStatusOverride("WORKED")}
                >
                  Worked
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${effectiveStatus === "RESERVED" ? "active" : ""}`}
                  onClick={() => setStatusOverride("RESERVED")}
                >
                  Reserved
                </button>
              </div>
            </>
          )}

          <label className="field-label">Notes</label>
          <textarea
            className="field-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes..."
          />

          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
