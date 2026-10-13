import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Minus, Plus } from "lucide-react";
import type { PaymentStatus, WorkLog, WorkLogInput, WorkStatus } from "../types";
import { formatCurrency, isPastOrToday, joinWorks, parseWorks, todayISO } from "../utils/format";
import { EVENT_TYPES, SERVICE_GROUPS, servicePrice } from "../data/services";
import { DateField, SelectField, TimeField } from "./Pickers";
import { useSheet } from "../utils/useSheet";

interface LogFormProps {
  initial?: WorkLog | null;
  defaultDate?: string;
  forceStatus?: WorkStatus;
  title: string;
  onSubmit: (input: WorkLogInput) => void;
  onClose: () => void;
}

const KNOWN_SERVICES = new Set(SERVICE_GROUPS.flatMap((g) => g.services.map((s) => s.name)));

export function LogForm({ initial, defaultDate, forceStatus, title, onSubmit, onClose }: LogFormProps) {
  const { closing, close, sheetRef } = useSheet(onClose);
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayISO());
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? "");
  const [altPhone, setAltPhone] = useState(initial?.altPhone ?? "");
  const [selectedWorks, setSelectedWorks] = useState<string[]>(parseWorks(initial?.work ?? ""));
  const [customWork, setCustomWork] = useState("");
  const [eventType, setEventType] = useState(initial?.eventType ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [bridesmaids, setBridesmaids] = useState(initial?.bridesmaids ?? 0);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [typedAmount, setTypedAmount] = useState(initial ? String(initial.amount || "") : "");
  const [amountTouched, setAmountTouched] = useState(Boolean(initial));
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initial?.paymentStatus ?? "PENDING");
  const [own, setOwn] = useState(initial?.own ?? true);
  const [referrerName, setReferrerName] = useState(initial?.referrerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [privateNotes, setPrivateNotes] = useState(initial?.privateNotes ?? "");
  const [paidSoFar, setPaidSoFar] = useState(initial?.paidAmount ? String(initial.paidAmount) : "");
  const [statusOverride, setStatusOverride] = useState<WorkStatus | null>(initial?.status ?? forceStatus ?? null);
  const [error, setError] = useState<string | null>(null);

  const customServices = selectedWorks.filter((w) => !KNOWN_SERVICES.has(w));

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Menu prices add up into the amount until the amount is edited by hand.
  const menuTotal = useMemo(
    () => selectedWorks.reduce((sum, w) => sum + (servicePrice(w) ?? 0), 0),
    [selectedWorks]
  );
  const amount = amountTouched ? typedAmount : menuTotal ? String(menuTotal) : "";

  function toggleWork(w: string) {
    setSelectedWorks((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }

  function addCustomWork() {
    const w = customWork.replace(/,/g, "").trim();
    if (!w) return;
    setSelectedWorks((prev) => (prev.includes(w) ? prev : [...prev, w]));
    setCustomWork("");
  }

  const autoStatus: WorkStatus = isPastOrToday(date) ? "WORKED" : "RESERVED";
  const effectiveStatus = forceStatus ?? statusOverride ?? autoStatus;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const workValue = joinWorks(selectedWorks);
    if (!workValue || !date) {
      setError("Choose at least one service and a date.");
      return;
    }
    if (!own && !referrerName.trim()) {
      setError("Add who referred this booking.");
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      setError("Ready time needs to be after the start time.");
      return;
    }
    const amountNum = Number(amount) || 0;
    if (amountNum < 0) {
      setError("Amount can't be negative.");
      return;
    }

    const received = Math.min(Number(paidSoFar) || 0, amountNum);
    const fullyPaid = paymentStatus === "PAID" || (amountNum > 0 && received >= amountNum);
    const qty = initial?.qty && initial.qty > 1 ? initial.qty : 1;
    onSubmit({
      date,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      altPhone: altPhone.trim(),
      work: workValue,
      eventType,
      location: location.trim(),
      bridesmaids,
      qty,
      price: amountNum / qty,
      startTime,
      endTime,
      amount: amountNum,
      paymentStatus: fullyPaid ? "PAID" : "PENDING",
      paidAmount: fullyPaid ? amountNum : received,
      status: effectiveStatus,
      own,
      referrerName: own ? "" : referrerName.trim(),
      notes: notes.trim(),
      privateNotes: privateNotes.trim(),
    });
    close();
  }

  return (
    <div className={`modal-overlay ${closing ? "closing" : ""}`} onClick={close}>
      <div
        ref={sheetRef}
        className="modal-sheet form-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="modal-header">
          <button type="button" className="text-btn" onClick={close}>Cancel</button>
          <h2 className="modal-title">{title}</h2>
          <button type="submit" form="booking-form" className="save-pill">Save</button>
        </div>

        <form id="booking-form" onSubmit={handleSubmit} className="modal-body">
          {error && <div className="inline-error">{error}</div>}

          <fieldset className="form-section">
            <legend>The client</legend>
            <label className="field-label" htmlFor="f-name">Name</label>
            <input id="f-name" className="field-input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Bride or client's name" />

            <div className="field-row">
              <div>
                <label className="field-label" htmlFor="f-phone">Contact number</label>
                <input id="f-phone" type="tel" className="field-input" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+91" />
              </div>
              <div>
                <label className="field-label" htmlFor="f-alt">Alternative number</label>
                <input id="f-alt" type="tel" className="field-input" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>The occasion</legend>
            <div className="field-row">
              <div>
                <label className="field-label" htmlFor="f-date">Date</label>
                <DateField id="f-date" value={date} onChange={setDate} />
              </div>
              <div>
                <label className="field-label" htmlFor="f-event">Event</label>
                <SelectField
                  id="f-event"
                  label="Event"
                  value={eventType}
                  options={[...new Set([...EVENT_TYPES, eventType].filter(Boolean))]}
                  onChange={setEventType}
                />
              </div>
            </div>

            <label className="field-label" htmlFor="f-location">Place or venue</label>
            <input
              id="f-location"
              className="field-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Venue name, address or a Google Maps link"
            />

            <div className="field-row">
              <div>
                <label className="field-label" htmlFor="f-start">Start time</label>
                <TimeField id="f-start" label="Start time" value={startTime} onChange={setStartTime} />
              </div>
              <div>
                <label className="field-label" htmlFor="f-ready">Ready by</label>
                <TimeField id="f-ready" label="Ready by" value={endTime} onChange={setEndTime} />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Services</legend>
            {SERVICE_GROUPS.map((group) => (
              <div key={group.title} className="service-group">
                <div className="service-group-title">{group.title}</div>
                <div className="service-options">
                  {group.services.map((s) => {
                    const active = selectedWorks.includes(s.name);
                    return (
                      <button
                        key={s.name}
                        type="button"
                        className={`service-option ${active ? "active" : ""}`}
                        onClick={() => toggleWork(s.name)}
                        aria-pressed={active}
                      >
                        <span className="service-name">{s.name}</span>
                        <span className="service-price">{s.price ? formatCurrency(s.price) : "On call"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {customServices.length > 0 && (
              <div className="service-options">
                {customServices.map((w) => (
                  <button key={w} type="button" className="service-option active" onClick={() => toggleWork(w)} aria-pressed>
                    <span className="service-name">{w}</span>
                    <span className="service-price">Custom</span>
                  </button>
                ))}
              </div>
            )}

            <div className="work-custom-row">
              <input
                className="field-input"
                value={customWork}
                onChange={(e) => setCustomWork(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomWork();
                  }
                }}
                placeholder="Something else, e.g. Hair only"
                aria-label="Add a custom service"
              />
              <button type="button" className="ghost-btn" onClick={addCustomWork}>Add</button>
            </div>

            <label className="field-label">Bridesmaids' makeup</label>
            <div className="stepper">
              <button type="button" className="round-btn" onClick={() => setBridesmaids((n) => Math.max(0, n - 1))} aria-label="Fewer bridesmaids">
                <Minus size={16} />
              </button>
              <span className="stepper-value">{bridesmaids === 0 ? "None" : bridesmaids}</span>
              <button type="button" className="round-btn" onClick={() => setBridesmaids((n) => n + 1)} aria-label="More bridesmaids">
                <Plus size={16} />
              </button>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Payment</legend>
            <label className="field-label" htmlFor="f-amount">Amount</label>
            <input
              id="f-amount"
              type="number"
              inputMode="numeric"
              min="0"
              className="field-input field-amount"
              value={amount}
              onChange={(e) => {
                setAmountTouched(true);
                setTypedAmount(e.target.value);
              }}
              placeholder="0"
            />
            {amountTouched && menuTotal > 0 && Number(amount) !== menuTotal && (
              <button type="button" className="link-btn" onClick={() => setAmountTouched(false)}>
                Use menu total, {formatCurrency(menuTotal)}
              </button>
            )}

            <div className="segmented">
              <button type="button" className={`segmented-btn ${paymentStatus === "PENDING" ? "active" : ""}`} onClick={() => setPaymentStatus("PENDING")}>
                Payment due
              </button>
              <button type="button" className={`segmented-btn ${paymentStatus === "PAID" ? "active" : ""}`} onClick={() => setPaymentStatus("PAID")}>
                Paid
              </button>
            </div>

            <div className={`reveal-field ${paymentStatus === "PENDING" ? "open" : ""}`}>
              <div className="reveal-field-inner">
                <label className="field-label" htmlFor="f-paid">Received so far</label>
                <input
                  id="f-paid"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className="field-input"
                  value={paidSoFar}
                  onChange={(e) => setPaidSoFar(e.target.value)}
                  placeholder="Advance or part payment, if any"
                  tabIndex={paymentStatus === "PENDING" ? 0 : -1}
                />
              </div>
            </div>

            <div className="segmented">
              <button type="button" className={`segmented-btn ${own ? "active" : ""}`} onClick={() => setOwn(true)}>
                Direct client
              </button>
              <button type="button" className={`segmented-btn ${!own ? "active" : ""}`} onClick={() => setOwn(false)}>
                Referred
              </button>
            </div>

            <div className={`reveal-field ${!own ? "open" : ""}`}>
              <div className="reveal-field-inner">
                <label className="field-label" htmlFor="f-ref">Referred by</label>
                <input id="f-ref" className="field-input" value={referrerName} onChange={(e) => setReferrerName(e.target.value)} placeholder="Planner, studio or artist" tabIndex={own ? -1 : 0} />
              </div>
            </div>

            {!forceStatus && (
              <div className="segmented">
                <button type="button" className={`segmented-btn ${effectiveStatus === "RESERVED" ? "active" : ""}`} onClick={() => setStatusOverride("RESERVED")}>
                  Booked
                </button>
                <button type="button" className={`segmented-btn ${effectiveStatus === "WORKED" ? "active" : ""}`} onClick={() => setStatusOverride("WORKED")}>
                  Done
                </button>
              </div>
            )}
          </fieldset>

          <fieldset className="form-section">
            <legend>Notes for the team</legend>
            <textarea
              className="field-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Look, outfit colours, timings, anything the assistants should know"
              aria-label="Notes"
            />
          </fieldset>

          <fieldset className="form-section private-section">
            <legend>Notes for me</legend>
            <p className="field-hint">
              <LockKeyhole size={13} strokeWidth={1.8} /> Only you see these. Assistants never receive them.
            </p>
            <textarea
              className="field-input"
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
              rows={3}
              placeholder="Advance details, pricing notes, reminders"
              aria-label="Notes for me"
            />
          </fieldset>

          <button type="submit" className="primary-btn">Save booking</button>
        </form>
      </div>
    </div>
  );
}
