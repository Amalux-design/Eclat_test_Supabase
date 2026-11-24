import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Plus } from "lucide-react";
import type { BookingPhoto, PaymentStatus, PhotoChanges, WorkLog, WorkLogInput, WorkStatus } from "../types";
import { formatCurrency, isValidPhone, joinWorks, normalizePhone, parseWorks, receivedOf, splitQty, todayISO, withQty } from "../utils/format";
import { changedFields } from "../utils/editMerge";
import { generateId } from "../utils/id";
import { ServiceTiles } from "./ServiceTiles";
import { EVENT_TYPES, SERVICE_GROUPS, servicePrice } from "../data/services";
import { DateField, SelectField, TimeField } from "./Pickers";
import { useSheet } from "../utils/useSheet";
import { PhotoPicker } from "./Photos";
import { useConfirm } from "./ConfirmDialog";

interface LogFormProps {
  initial?: WorkLog | null;
  defaultDate?: string;
  forceStatus?: WorkStatus;
  title: string;
  /**
   * Resolves once the server confirms; rejects to keep the form open.
   * `changes` holds only the fields edited here (everything, for a new booking).
   * `draftId` stays the same however often this form retries its save.
   */
  onSubmit: (changes: Partial<WorkLogInput>, photos: PhotoChanges, draftId: string) => Promise<void>;
  onClose: () => void;
}

const KNOWN_SERVICES = new Set(SERVICE_GROUPS.flatMap((g) => g.services.map((s) => s.name)));

/**
 * Whole rupees from what was typed or pasted: "₹15,000.00" / "Rs 15000.00" / "15000/-" → 15000,
 * "5k" → 5000, "1.5L" → 150000. Never glues digits across a decimal point ("Rs 5000.00" was 500000).
 */
function rupees(text: string): number {
  const t = text
    .toLowerCase()
    .replace(/[\s,₹]/g, "")
    .replace(/^-/, "")
    .replace(/^(rs\.?|inr)/, "")
    .replace(/\/-?$/, "");
  const m = /^(\d+(?:\.\d*)?)(k|thousand|l|lac|lacs|lakh|lakhs)?$/.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (!m[2]) return Math.trunc(n);
    return Math.round(n * (m[2] === "k" || m[2] === "thousand" ? 1000 : 100000));
  }
  // Words around one plain number ("5000 advance"); anything less clear counts as nothing.
  const one = /^\D*(\d+)\D*$/.exec(t);
  return one ? Number(one[1]) : 0;
}

export function LogForm({ initial, defaultDate, forceStatus, title, onSubmit, onClose }: LogFormProps) {
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayISO());
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? "");
  const [altPhone, setAltPhone] = useState(initial?.altPhone ?? "");
  // Services in the order picked, each with a count ("2× Classic Bridal").
  const [works, setWorks] = useState<{ name: string; qty: number; price?: number }[]>(() =>
    // Each service keeps the price it was booked at; without one, the menu's.
    parseWorks(initial?.work ?? "").map(splitQty).map((w) => ({ ...w, price: w.price ?? servicePrice(w.name) ?? undefined }))
  );
  const [customRate, setCustomRate] = useState("");
  const [customWork, setCustomWork] = useState("");
  const [eventType, setEventType] = useState(initial?.eventType ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  // No longer edited here (bridesmaids go under "Something else"); an old saved count is kept as is.
  const bridesmaids = initial?.bridesmaids ?? 0;
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  // Amount = services total (automatic, from the tiles) + extra (typed by hand,
  // may be negative for a discount). Editing: extra = saved amount − services total.
  const [extra, setExtra] = useState(() => {
    if (!initial) return "";
    const savedMenuTotal = parseWorks(initial.work)
      .map(splitQty)
      .reduce((sum, w) => sum + (w.price ?? servicePrice(w.name) ?? 0) * w.qty, 0);
    const diff = initial.amount - savedMenuTotal;
    return diff ? String(diff) : "";
  });
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initial?.paymentStatus ?? "PENDING");
  const [own, setOwn] = useState(initial?.own ?? true);
  const [referrerName, setReferrerName] = useState(initial?.referrerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [privateNotes, setPrivateNotes] = useState(initial?.privateNotes ?? "");
  const initialReceived = initial ? receivedOf(initial) : 0;
  const [paidSoFar, setPaidSoFar] = useState(initialReceived ? String(initialReceived) : "");
  // What "Received so far" held before "Paid" was tapped, so "Payment due" can undo exactly that.
  const [beforePaid, setBeforePaid] = useState<string | null>(null);
  const [dueOpen, setDueOpen] = useState(false);
  const [draftId] = useState(generateId);
  const [statusOverride, setStatusOverride] = useState<WorkStatus | null>(initial?.status ?? forceStatus ?? null);
  const [error, setError] = useState<string | null>(null);
  const [unaddedWarned, setUnaddedWarned] = useState(false);
  // The balance the person already agreed to leave due when marking as done.
  const [dueAccepted, setDueAccepted] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<BookingPhoto[]>([]);

  // Unsaved changes: a swipe, backdrop tap or Cancel asks before throwing them away.
  const snapshot = JSON.stringify([
    date, clientName, clientPhone, altPhone, works, customWork, customRate, eventType, location, bridesmaids,
    startTime, endTime, extra, paymentStatus, own, referrerName, notes, privateNotes, paidSoFar, statusOverride,
    newPhotos.length, removedPhotos.length,
  ]);
  const [initialSnapshot] = useState(snapshot);
  const dirty = snapshot !== initialSnapshot;
  const confirm = useConfirm();
  const { closing, close, requestClose, sheetRef } = useSheet(onClose, {
    confirmDismiss:
      dirty && !submitting
        ? () =>
            confirm({
              title: "Discard changes?",
              message: "What you've entered in this booking won't be saved.",
              confirmLabel: "Discard",
              destructive: true,
            })
        : undefined,
  });

  const customServices = works.filter((w) => !KNOWN_SERVICES.has(w.name)).map((w) => ({ name: w.name, price: w.price }));
  const qtyByName = Object.fromEntries(works.map((w) => [w.name, w.qty]));

  const priceByName = Object.fromEntries(works.map((w) => [w.name, w.price]));

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Menu prices add up automatically.
  const menuTotal = useMemo(
    () => works.reduce((sum, w) => sum + (w.price ?? 0) * w.qty, 0),
    [works]
  );
  // `extra` keeps the box's text as typed ("2500.50", "5k"), with a leading "-" for a discount;
  // the number is read from it here. Tidying it on every key glued digits across a "." (2500.50 → 250050).
  const extraNum = (extra.startsWith("-") ? -1 : 1) * rupees(extra.replace(/^-/, ""));
  // With no priced service the box is the whole amount, so it can't be a discount.
  const amount = String(Math.max(0, menuTotal + (menuTotal === 0 ? Math.abs(extraNum) : extraNum)));
  const [keptTotal, setKeptTotal] = useState<number | null>(null);

  /** Change the services, keeping a total that was typed by hand. */
  function applyWorks(next: typeof works) {
    const before = works.reduce((sum, w) => sum + (w.price ?? 0) * w.qty, 0);
    const after = next.reduce((sum, w) => sum + (w.price ?? 0) * w.qty, 0);
    setWorks(next);
    // An agreed amount typed before any service stays the total through every service
    // change, until the amount is edited by hand; the difference shows as extra or discount.
    const target = keptTotal ?? (before === 0 && after > 0 && extraNum > 0 ? extraNum : null);
    if (target !== null) {
      setExtra(target - after ? String(target - after) : "");
      setKeptTotal(target);
    } else if (after === 0 && extraNum < 0) {
      // A discount means nothing without a service: clear it rather than hide it.
      setExtra("");
    }
  }

  function setWorkQty(name: string, qty: number) {
    applyWorks(
      qty <= 0
        ? works.filter((w) => w.name !== name)
        : works.some((w) => w.name === name)
          ? works.map((w) => (w.name === name ? { ...w, qty } : w))
          : [...works, { name, qty, price: servicePrice(name) ?? undefined }]
    );
  }

  function addCustomWork() {
    const w = customWork.replace(/,/g, "").trim();
    if (!w) return;
    const price = rupees(customRate) || (servicePrice(w) ?? undefined);
    if (!works.some((x) => x.name === w)) applyWorks([...works, { name: w, qty: 1, price }]);
    setCustomRate("");
    setCustomWork("");
    setUnaddedWarned(false);
  }

  // New bookings start as Booked; "Done" is set later (here or "Mark as done").
  const effectiveStatus: WorkStatus = forceStatus ?? statusOverride ?? "RESERVED";

  // Money received is only what "Received so far" says. Paid / Payment due always shows
  // what will be saved: a raised total is due again; nothing is received without a tap or a number.
  const receivedNow = rupees(paidSoFar);
  const shownPayment: PaymentStatus =
    Number(amount) > 0 ? (receivedNow >= Number(amount) ? "PAID" : "PENDING") : paymentStatus;
  const refund = Number(amount) > 0 ? receivedNow - Number(amount) : 0;

  function buildInput(): WorkLogInput {
    const amountNum = Math.max(0, Number(amount) || 0);
    const fullyPaid = shownPayment === "PAID";
    const qty = initial?.qty && initial.qty > 1 ? initial.qty : 1;
    return {
      date,
      clientName: clientName.trim(),
      clientPhone: normalizePhone(clientPhone),
      altPhone: normalizePhone(altPhone),
      work: joinWorks(works.map((w) => withQty(w.name, w.qty, w.price))),
      eventType,
      location: location.trim(),
      bridesmaids,
      qty,
      price: amountNum / qty,
      startTime,
      endTime,
      amount: amountNum,
      paymentStatus: fullyPaid ? "PAID" : "PENDING",
      paidAmount: receivedNow,
      status: effectiveStatus,
      own,
      referrerName: own ? "" : referrerName.trim(),
      notes: notes.trim(),
      privateNotes: privateNotes.trim(),
    };
  }
  // The form as it opened, so a save sends only what was edited here.
  const [openedInput] = useState(() => (initial ? { ...buildInput(), status: initial.status } : null));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Only the name is required; everything else can be filled in later.
    if (!clientName.trim()) {
      setError("Add the client's name to save this booking.");
      document.getElementById("f-name")?.focus();
      return;
    }
    // A typed service only counts once added: never save without it silently.
    if (customWork.trim() || customRate) {
      setUnaddedWarned(true);
      const box = document.getElementById("f-custom");
      box?.focus();
      box?.scrollIntoView({ block: "center" });
      return;
    }
    // Removing a service can leave a discount larger than what is left to discount.
    if (menuTotal > 0 && extraNum < 0 && -extraNum > menuTotal) {
      setError(`The discount can't be more than the services total (${formatCurrency(menuTotal)}).`);
      document.getElementById("f-extra")?.focus();
      return;
    }
    if (submitting) return;
    // Marking as done with money still due: ask, in case the rest was received.
    // Asked once per balance: a second Save after a "changed on another device" warning doesn't ask again.
    const balance = Number(amount) - receivedNow;
    if (effectiveStatus === "WORKED" && initial?.status !== "WORKED" && balance > 0 && dueAccepted !== balance) {
      const ok = await confirm({
        title: "Balance still due",
        message: `${formatCurrency(balance)} of ${formatCurrency(Number(amount))} hasn't been received. Mark as done anyway? If the full amount was paid, tap Paid first.`,
        confirmLabel: "Mark as done",
      });
      if (!ok) return;
      setDueAccepted(balance);
    }
    setSubmitting(true);
    const input = buildInput();
    const changes = openedInput ? changedFields(openedInput, input) : input;
    try {
      await onSubmit(changes, { add: newPhotos, remove: removedPhotos }, draftId);
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
    <div className={`modal-overlay ${closing ? "closing" : ""}`} onClick={() => void requestClose()}>
      <div
        ref={sheetRef}
        className="modal-sheet form-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="modal-header">
          <button type="button" className="text-btn" onClick={() => void requestClose()}>Cancel</button>
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
            <ServiceTiles qty={qtyByName} prices={priceByName} onChange={setWorkQty} custom={customServices} />

            <div className="quote-custom">
              <input
                id="f-custom"
                className="field-input"
                value={customWork}
                onChange={(e) => setCustomWork(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomWork();
                  }
                }}
                placeholder="Something else, e.g. Hairdo"
                aria-label="Add a custom service"
              />
              <input
                className="field-input"
                inputMode="numeric"
                value={customRate}
                // Kept as typed (read with rupees() when added), so "3500.50" can't become 350050.
                onChange={(e) => setCustomRate(e.target.value)}
                onBlur={() => setCustomRate((v) => (v.trim() ? String(rupees(v) || "") : ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomWork();
                  }
                }}
                placeholder="Rate ₹"
                aria-label="Custom service rate"
              />
              <button type="button" className="ghost-btn with-icon" onClick={addCustomWork}>
                <Plus size={16} /> Add
              </button>
            </div>
            {unaddedWarned && (customWork.trim() || customRate) && (
              <p className="field-hint warn" role="alert">
                Not saved yet: {customWork.trim() ? "tap Add to include this service" : "this rate needs a service name"}, or clear both boxes.
              </p>
            )}

            {/* Bridesmaids are added under "Something else": with a rate, or none for "Included". */}
          </fieldset>

          <fieldset className="form-section">
            <legend>Payment</legend>
            <div className="bill">
              <div className="bill-row">
                <span>Services total</span>
                <span className="bill-figure">{formatCurrency(menuTotal)}</span>
              </div>
              <div className="bill-row">
                <label htmlFor="f-extra">
                  {menuTotal === 0 ? "Amount" : extra.startsWith("-") ? "Discount" : "Extra"}
                </label>
                {menuTotal > 0 && (
                  <button
                    type="button"
                    className={`bill-sign ${extra.startsWith("-") ? "minus" : ""}`}
                    onClick={() =>
                      setExtra((v) =>
                        v.startsWith("-") ? v.slice(1) : v ? "-" + String(Math.min(rupees(v), menuTotal)) : "-"
                      )
                    }
                    aria-label={extra.startsWith("-") ? "Switch to extra (add)" : "Switch to discount (subtract)"}
                  >
                    {extra.startsWith("-") ? "−" : "+"}
                  </button>
                )}
                <span className="bill-input">
                  <span aria-hidden="true">₹</span>
                  <input
                    id="f-extra"
                    type="text"
                    inputMode="numeric"
                    value={extra.replace(/^-/, "")}
                    onChange={(e) => {
                      const typed = e.target.value;
                      // A pasted "-2000" is a discount, when there is a service to take it off.
                      const minus = menuTotal > 0 && (typed.trim().startsWith("-") || extra.startsWith("-"));
                      const text = typed.replace(/^\s*-\s*/, "");
                      // A discount can't take off more than the services cost.
                      const kept = minus && rupees(text) > menuTotal ? String(menuTotal) : text;
                      setExtra(kept.trim() ? (minus ? "-" : "") + kept : "");
                      setKeptTotal(null);
                    }}
                    // Leaving the box shows the amount actually used ("2500.50" → 2500, "5k" → 5000).
                    onBlur={() =>
                      setExtra((v) => {
                        const n = rupees(v.replace(/^-/, ""));
                        return n ? (v.startsWith("-") ? "-" : "") + n : "";
                      })
                    }
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
              {keptTotal !== null && Number(amount) === keptTotal
                ? `Total kept at ${formatCurrency(keptTotal)}, the amount you typed. Change it above if the price is different.`
                : menuTotal > 0
                ? "Tap + / − to add an extra (travel, extensions) or take off a discount."
                : "Type the full amount for this booking."}
            </p>

            <div className="segmented">
              <button
                type="button"
                className={`segmented-btn ${shownPayment === "PENDING" ? "active" : ""}`}
                onClick={() => {
                  setPaymentStatus("PENDING");
                  if (beforePaid !== null) {
                    // Undo this form's "Paid" tap exactly.
                    setPaidSoFar(beforePaid);
                    setBeforePaid(null);
                  } else if (shownPayment === "PAID" && Number(amount) > 0) {
                    // Saved as paid: never erase real money; show the box so it can be corrected.
                    setDueOpen(true);
                    window.setTimeout(() => (document.getElementById("f-paid") as HTMLInputElement | null)?.select(), 50);
                  }
                }}
              >
                Payment due
              </button>
              <button
                type="button"
                className={`segmented-btn ${shownPayment === "PAID" ? "active" : ""}`}
                onClick={() => {
                  setPaymentStatus("PAID");
                  setDueOpen(false);
                  // Paid in full now: received becomes the total, once (an overpayment stays as it is).
                  if (Number(amount) > receivedNow) {
                    if (beforePaid === null) setBeforePaid(paidSoFar);
                    setPaidSoFar(String(amount));
                  }
                }}
              >
                Paid
              </button>
            </div>

            {refund > 0 && (
              <p className="field-hint" role="status">
                {formatCurrency(receivedNow)} received, {formatCurrency(refund)} to refund.
              </p>
            )}
            <div className={`reveal-field ${shownPayment === "PENDING" || dueOpen ? "open" : ""}`}>
              <div className="reveal-field-inner">
                <label className="field-label" htmlFor="f-paid">Received so far</label>
                <input
                  id="f-paid"
                  type="text"
                  inputMode="numeric"
                  className="field-input"
                  value={paidSoFar}
                  onChange={(e) => {
                    setPaidSoFar(e.target.value);
                    setBeforePaid(null);
                  }}
                  onBlur={() => paidSoFar && setPaidSoFar(rupees(paidSoFar) ? String(rupees(paidSoFar)) : "")}
                  placeholder="Advance or part payment, if any"
                  tabIndex={shownPayment === "PENDING" || dueOpen ? 0 : -1}
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
