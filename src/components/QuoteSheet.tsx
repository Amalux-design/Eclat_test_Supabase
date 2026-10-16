import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { SERVICE_GROUPS, servicePrice } from "../data/services";
import { BUSINESS } from "../data/business";
import { formatCurrency, todayISO } from "../utils/format";
import { useSheet } from "../utils/useSheet";
import { DateField } from "./Pickers";
import { docTotal, newDocNumber, saveDocument, type DocData, type DocKind } from "../utils/invoice";

interface Row {
  key: number;
  date: string;
  service: string;
  rate: string;
  people: string;
}

const SERVICE_NAMES = SERVICE_GROUPS.flatMap((g) => g.services.map((s) => s.name));
const num = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, "")) || 0);

/** Build a quotation or invoice for anyone, without saving a booking. */
export function QuoteSheet({ onClose }: { onClose: () => void }) {
  const { closing, close, sheetRef } = useSheet(onClose);
  const [kind, setKind] = useState<DocKind>("quote");
  const [name, setName] = useState("");
  const [phones, setPhones] = useState("");
  const [place, setPlace] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: 1, date: "", service: "", rate: "", people: "1" }]);
  const [travel, setTravel] = useState("");
  const [notes, setNotes] = useState(BUSINESS.defaultNote ?? "");
  const [advance, setAdvance] = useState("");
  const [advanceDate, setAdvanceDate] = useState(todayISO());
  const [method, setMethod] = useState("Google Pay (GPay)");
  const [error, setError] = useState<string | null>(null);

  const docRows = rows
    .filter((r) => r.service.trim())
    .map((r) => {
      const rate = num(r.rate);
      const qty = Math.max(1, Math.round(num(r.people)) || 1);
      return { date: r.date || undefined, label: r.service.trim(), rate, qty, amount: rate * qty };
    });
  const extras = num(travel) ? [{ label: "Travel", amount: num(travel) }] : [];
  const total = docTotal({ rows: docRows, extras });
  const eventDates = useMemo(() => {
    const ds = [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();
    return ds
      .map((d) => new Date(d + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))
      .join(" & ");
  }, [rows]);

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        // Picking a menu service fills its price (still editable).
        if (patch.service !== undefined) {
          const p = servicePrice(patch.service);
          if (p) next.rate = String(p);
        }
        return next;
      })
    );
  }

  function addRow() {
    setRows((rs) => [...rs, { key: Date.now(), date: rs[rs.length - 1]?.date ?? "", service: "", rate: "", people: "1" }]);
  }

  async function download() {
    if (!name.trim()) return setError("Add the client's name.");
    if (!docRows.length) return setError("Add at least one service.");
    setError(null);
    const adv = num(advance);
    const data: DocData = {
      kind,
      number: newDocNumber(kind),
      issueDate: todayISO(),
      clientName: name.trim(),
      clientLines: [phones.trim(), place.trim()].filter(Boolean),
      rows: docRows,
      extras,
      notes: notes.split("\n"),
      ...(kind === "invoice"
        ? {
            received: adv,
            advance: adv ? { amount: adv, date: advanceDate, method: method.trim(), eventDates: eventDates || "the booked date" } : undefined,
          }
        : {}),
    };
    try {
      await saveDocument(data);
    } catch {
      setError("Couldn't create the PDF. Try again.");
    }
  }

  const label = kind === "quote" ? "Download quotation" : "Download invoice";

  return createPortal(
    <div className={`modal-overlay ${closing ? "closing" : ""}`} onClick={close}>
      <div ref={sheetRef} className="modal-sheet form-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quote or invoice">
        <div className="modal-header">
          <button type="button" className="text-btn" onClick={close}>Cancel</button>
          <h2 className="modal-title">{kind === "quote" ? "Quotation" : "Invoice"}</h2>
          <button type="button" className="save-pill" onClick={() => void download()}>PDF</button>
        </div>

        <div className="modal-body">
          <div className="segmented" role="tablist" aria-label="Document type">
            {(["quote", "invoice"] as DocKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                className={`segmented-btn ${kind === k ? "active" : ""}`}
                onClick={() => setKind(k)}
              >
                {k === "quote" ? "Quotation" : "Invoice"}
              </button>
            ))}
          </div>
          <p className="field-hint">
            {kind === "quote"
              ? "Price quote with your booking policy on page 2. Nothing is saved to bookings."
              : "Invoice for any client. Add an advance to include the payment confirmation page."}
          </p>

          {error && <div className="inline-error">{error}</div>}

          <fieldset className="form-section">
            <legend>The client</legend>
            <label className="field-label" htmlFor="q-name">Name</label>
            <input id="q-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client's name" />
            <label className="field-label" htmlFor="q-phone">Contact numbers</label>
            <input id="q-phone" className="field-input" inputMode="tel" value={phones} onChange={(e) => setPhones(e.target.value)} placeholder="e.g. 9947612345, 6282860028" />
            <label className="field-label" htmlFor="q-place">Place</label>
            <input id="q-place" className="field-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Calicut, Thiruvannur" />
          </fieldset>

          <fieldset className="form-section">
            <legend>Services</legend>
            <datalist id="q-services">
              {SERVICE_NAMES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {rows.map((r, i) => (
              <div key={r.key} className="quote-row">
                <div className="quote-row-head">
                  <span className="field-label">Item {i + 1}</span>
                  {rows.length > 1 && (
                    <button type="button" className="icon-btn" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove item ${i + 1}`}>
                      <X size={16} />
                    </button>
                  )}
                </div>
                <input
                  className="field-input"
                  list="q-services"
                  value={r.service}
                  onChange={(e) => update(r.key, { service: e.target.value })}
                  placeholder="Service, e.g. Signature Bridal or Hairdo"
                  aria-label={`Service ${i + 1}`}
                />
                <div className="quote-row-fields">
                  <DateField id={`q-date-${r.key}`} value={r.date} onChange={(v) => update(r.key, { date: v })} />
                  <input className="field-input" inputMode="numeric" value={r.rate} onChange={(e) => update(r.key, { rate: e.target.value })} placeholder="Rate ₹" aria-label={`Rate ${i + 1}`} />
                  <input className="field-input" inputMode="numeric" value={r.people} onChange={(e) => update(r.key, { people: e.target.value })} placeholder="People" aria-label={`People ${i + 1}`} />
                </div>
                {num(r.rate) > 0 && (
                  <p className="field-hint quote-subtotal">
                    {formatCurrency(num(r.rate))} × {Math.max(1, Math.round(num(r.people)) || 1)} = {formatCurrency(num(r.rate) * (Math.max(1, Math.round(num(r.people)) || 1)))}
                  </p>
                )}
              </div>
            ))}
            <button type="button" className="ghost-btn full with-icon" onClick={addRow}>
              <Plus size={16} /> Add item
            </button>

            <label className="field-label" htmlFor="q-travel">Travel charges</label>
            <input id="q-travel" className="field-input" inputMode="numeric" value={travel} onChange={(e) => setTravel(e.target.value)} placeholder="₹ (optional)" />
          </fieldset>

          {kind === "invoice" && (
            <fieldset className="form-section">
              <legend>Advance</legend>
              <div className="field-row">
                <div>
                  <label className="field-label" htmlFor="q-adv">Advance received</label>
                  <input id="q-adv" className="field-input" inputMode="numeric" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="₹ (optional)" />
                </div>
                <div>
                  <label className="field-label" htmlFor="q-adv-date">Received on</label>
                  <DateField id="q-adv-date" value={advanceDate} onChange={setAdvanceDate} />
                </div>
              </div>
              <label className="field-label" htmlFor="q-method">Paid via</label>
              <input id="q-method" className="field-input" value={method} onChange={(e) => setMethod(e.target.value)} />
            </fieldset>
          )}

          <fieldset className="form-section">
            <legend>Notes</legend>
            <textarea className="field-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" placeholder="One note per line" />
          </fieldset>

          <div className="quote-total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          {kind === "invoice" && num(advance) > 0 && (
            <p className="field-hint">Balance {formatCurrency(Math.max(0, total - num(advance)))}</p>
          )}

          <button type="button" className="primary-btn" onClick={() => void download()}>
            {label}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
