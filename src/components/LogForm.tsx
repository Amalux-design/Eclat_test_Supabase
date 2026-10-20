import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Minus, Plus } from "lucide-react";
import type { BookingPhoto, PaymentStatus, PhotoChanges, WorkLog, WorkLogInput, WorkStatus } from "../types";
import { formatCurrency, isPastOrToday, isValidPhone, joinWorks, normalizePhone, parseWorks, splitQty, todayISO, withQty } from "../utils/format";
import { ServiceTiles } from "./ServiceTiles";
import { EVENT_TYPES, SERVICE_GROUPS, servicePrice } from "../data/services";
import { DateField, SelectField, TimeField } from "./Pickers";
import { useSheet } from "../utils/useSheet";
import { PhotoPicker } from "./Photos";

interface LogFormProps {
  initial?: WorkLog | null;
  defaultDate?: string;
  forceStatus?: WorkStatus;
  title: string;
  /** Resolves once the server confirms; rejects to keep the form open. */
  onSubmit: (input: WorkLogInput, photos: PhotoChanges) => Promise<void>;
  onClose: () => void;
}

const KNOWN_SERVICES = new Set(SERVICE_GROUPS.flatMap((g) => g.services.map((s) => s.name)));

export function LogForm({ initial, defaultDate, forceStatus, title, onSubmit, onClose }: LogFormProps) {
  const { closing, close, sheetRef } = useSheet(onClose);
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayISO());
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? "");
  const [altPhone, setAltPhone] = useState(initial?.altPhone ?? "");
  // Services in the order picked, each with a count ("2× Classic Bridal").
  const [works, setWorks] = useState<{ name: string; qty: number }[]>(parseWorks(initial?.work ?? "").map(splitQty));
  const [customWork, setCustomWork] = useState("");
  const [eventType, setEventType] = useState(initial?.eventType ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [bridesmaids, setBridesmaids] = useState(initial?.bridesmaids ?? 0);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  // Amount = services total (automatic, from the tiles) + extra (typed by hand,
  // may be negative for a discount). Editing: extra = saved amount − services total.
  const [extra, setExtra] = useState(() => {
    if (!initial) return "";
    const savedMenuTotal = parseWorks(initial.work)
      .map(splitQty)
      .reduce((sum, w) => sum + (servicePrice(w.name) ?? 0) * w.qty, 0);
    const diff = initial.amount - savedMenuTotal;
    return diff ? String(diff) : "";
  });
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initial?.paymentStatus ?? "PENDING");
  const [own, setOwn] = useState(initial?.own ?? true);
  const [referrerName, setReferrerName] = useState(initial?.referrerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [privateNotes, setPrivateNotes] = useState(initial?.privateNotes ?? "");
  const [paidSoFar, setPaidSoFar] = useState(initial?.paidAmount ? String(initial.paidAmount) : "");
  const [statusOverride, setStatusOverride] = useState<WorkStatus | null>(initial?.status ?? forceStatus ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<BookingPhoto[]>([]);

  const customServices = works.filter((w) => !KNOWN_SERVICES.has(w.name)).map((w) => ({ name: w.name }));
  const qtyByName = Object.fromEntries(works.map((w) => [w.name, w.qty]));

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Menu prices add up automatically.
  const menuTotal = useMemo(
    () => works.reduce((sum, w) => sum + (servicePrice(w.name) ?? 0) * w.qty, 0),
    [works]
  );
  const extraNum = Number(extra.replace(/[^\d.-]/g, "")) || 0;
  const amount = String(Math.max(0, menuTotal + extraNum));

  function setWorkQty(name: string, qty: number) {
    setWorks((prev) => {
      if (qty <= 0) return prev.filter((w) => w.name !== name);
      return prev.some((w) => w.name === name)
        ? prev.map((w) => (w.name === name ? { ...w, qty } : w))
        : [...prev, { name, qty }];
    });
  }

  function addCustomWork() {
    const w = customWork.replace(/,/g, "").trim();
    if (!w) return;
    setWorks((prev) => (prev.some((x) => x.name === w) ? prev : [...prev, { name: w, qty: 1 }]));
    setCustomWork("");
  }

  const autoStatus: WorkStatus = isPastOrToday(date) ? "WORKED" : "RESERVED";
  const effectiveStatus = forceStatus ?? statusOverride ?? autoStatus;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Only the name is required; everything else can be filled in later.
    if (!clientName.trim()) {
      setError("Add the client's name to save this booking.");
      document.getElementById("f-name")?.focus();
      return;
    }
    const workValue = joinWorks(works.map((w) => withQty(w.name, w.qty)));
    const amountNum = Math.max(0, Number(amount) || 0);

    const received = Math.min(Number(paidSoFar) || 0, amountNum);
    const fullyPaid = paymentStatus === "PAID" || (amountNum > 0 && received >= amountNum);
    const qty = initial?.qty && initial.qty > 1 ? initial.qty : 1;
    if (submitting) return;
    setSubmitting(true);
    const input: WorkLogInput = {
      date,
      clientName: clientName.trim(),
      clientPhone: normalizePhone(clientPhone),
      altPhone: normalizePhone(altPhone),
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
    };
    try {
      await onSubmit(input, { add: newPhotos, remove: removedPhotos });
      close();
    } catch (err) {
      // Nothing is lost: the form stays open with everything still filled in.
      setError(err instanceof Error ? err.message : "Couldn't save. Check your connection and try again.");
      setSubmitting(false);
      document.querySelector(".form-sheet")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Portalled to <body> so page animations never shift the sheet.
  return createPortal(
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
          <button type="submit" form="booking-form" className="save-pill" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>

        <form id="booking-form" onSubmit={handleSubmit} className="modal-body">
          {error && <div className="inline-error">{error}</div>}

          <fieldset className="form-section">
            <legend>The client</legend>
            <label className="field-label" htmlFor="f-name">Name (required)</label>
            <input id="f-name" className="field-input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Bride or client's name" />

            <div className="field-row">
              <div>
                <label className="field-label" htmlFor="f-phone">Contact number</label>
                <input id="f-phone" type="tel" inputMode="tel" autoComplete="tel-national" className="field-input" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="10-digit mobile" />
                {!isValidPhone(clientPhone) && <p className="field-hint warn">Not a 10-digit mobile. It will be saved as typed.</p>}
              </div>
              <div>
                <label className="field-label" htmlFor="f-alt">Alternative number</label>
                <input id="f-alt" type="tel" inputMode="tel" autoComplete="tel-national" className="field-input" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="Optional" />
                {!isValidPhone(altPhone) && <p className="field-hint warn">Not a 10-digit mobile. It will be saved as typed.</p>}
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
            <ServiceTiles qty={qtyByName} onChange={setWorkQty} custom={customServices} />

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
            <div className="bill">
              <div className="bill-row">
                <span>Services total</span>
                <span className="bill-figure">{formatCurrency(menuTotal)}</span>
              </div>
              <div className="bill-row">
                <label htmlFor="f-extra">{menuTotal > 0 ? "Extra" : "Amount"}</label>
                <span className="bill-input">
                  <span aria-hidden="true">₹</span>
                  <input
                    id="f-extra"
                    type="text"
                    inputMode="numeric"
                    value={extra}
                    onChange={(e) => setExtra(e.target.value.replace(/[^\d-]/g, ""))}
                    placeholder="0"
                    aria-describedby="f-extra-hint"
                  />
                </span>
              </div>
              <div className="bill-row bill-total">
                <span>Total</span>
                <span className="bill-figure">{formatCurrency(Number(amount))}</span>
              </div>
            </div>
            <p id="f-extra-hint" className="field-hint">
              {menuTotal > 0
                ? "Extra is added to the services, e.g. travel or extensions. Use a minus for a discount: -2000."
                : "Type the full amount for this booking."}
            </p>

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

          <fieldset className="form-section">
            <legend>Reference photos</legend>
            <p className="field-hint">Shared with the team. Removed automatically 2 months after the work date.</p>
            <PhotoPicker
              existing={(initial?.photos ?? []).filter((p) => !removedPhotos.some((r) => r.id === p.id))}
              added={newPhotos}
              onAdd={(files) => setNewPhotos((prev) => [...prev, ...files])}
              onRemoveExisting={(photo) => setRemovedPhotos((prev) => [...prev, photo])}
              onRemoveAdded={(i) => setNewPhotos((prev) => prev.filter((_, idx) => idx !== i))}
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

          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? "Saving…" : "Save booking"}
          </button>
        </form>
      </div>
    </div>,
    document.body

  );
}
