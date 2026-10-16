import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { SERVICE_GROUPS, servicePrice } from "../data/services";
import { BUSINESS } from "../data/business";
import { formatCurrency, todayISO, withQty } from "../utils/format";
import { ServiceTiles } from "./ServiceTiles";
import { useSheet } from "../utils/useSheet";
import { DateField } from "./Pickers";
import { docTotal, newDocNumber, saveDocument, type DocData, type DocKind } from "../utils/invoice";

interface Line {
  name: string;
  qty: number;
  rate: string;
  date: string;
}

const MENU = new Set(SERVICE_GROUPS.flatMap((g) => g.services.map((s) => s.name)));
const num = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, "")) || 0);

/** Build a quotation or invoice for anyone, without saving a booking. */
export function QuoteSheet({ onClose }: { onClose: () => void }) {
  const { closing, close, sheetRef } = useSheet(onClose);
  const [kind, setKind] = useState<DocKind>("quote");
  const [name, setName] = useState("");
  const [phones, setPhones] = useState("");
  const [place, setPlace] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customName, setCustomName] = useState("");
  const [customRate, setCustomRate] = useState("");
  const [travel, setTravel] = useState("");
  const [notes, setNotes] = useState(BUSINESS.defaultNote ?? "");
  const [advance, setAdvance] = useState("");
  const [advanceDate, setAdvanceDate] = useState(todayISO());
  const [method, setMethod] = useState("Google Pay (GPay)");
  const [error, setError] = useState<string | null>(null);

  const docRows = lines.map((l) => {
    const rate = num(l.rate);
    return { date: l.date || undefined, label: l.name, rate, qty: l.qty, amount: rate * l.qty };
  });
  const extras = num(travel) ? [{ label: "Travel", amount: num(travel) }] : [];
  const total = docTotal({ rows: docRows, extras });
  const eventDates = useMemo(() => {
    const ds = [...new Set(lines.map((l) => l.date).filter(Boolean))].sort();
    return ds
      .map((d) => new Date(d + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))
      .join(" & ");
  }, [lines]);

  // Tiles: add, change the count, or remove (qty 0).
  function setQty(name: string, qty: number) {
    setLines((ls) => {
      if (qty <= 0) return ls.filter((l) => l.name !== name);
      if (ls.some((l) => l.name === name)) return ls.map((l) => (l.name === name ? { ...l, qty } : l));
      const p = servicePrice(name);
      return [...ls, { name, qty, rate: p ? String(p) : "", date: ls[ls.length - 1]?.date ?? "" }];
    });
  }

  function editLine(name: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.name === name ? { ...l, ...patch } : l)));
  }

  function addCustom() {
    const name = customName.replace(/,/g, "").trim();
    if (!name) return;
    setLines((ls) =>
      ls.some((l) => l.name === name)
        ? ls
        : [...ls, { name, qty: 1, rate: customRate, date: ls[ls.length - 1]?.date ?? "" }]
    );
    setCustomName("");
    setCustomRate("");
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
            <ServiceTiles
              qty={Object.fromEntries(lines.map((l) => [l.name, l.qty]))}
              onChange={setQty}
              custom={lines.filter((l) => !MENU.has(l.name)).map((l) => ({ name: l.name, price: num(l.rate) || undefined }))}
            />

            <div className="quote-custom">
              <input className="field-input" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Something else, e.g. Hairdo" aria-label="Custom item" />
              <input className="field-input" inputMode="numeric" value={customRate} onChange={(e) => setCustomRate(e.target.value)} placeholder="Rate ₹" aria-label="Custom item rate" />
              <button type="button" className="ghost-btn with-icon" onClick={addCustom}>
                <Plus size={16} /> Add
              </button>
            </div>

            {lines.length > 0 && (
              <div className="quote-lines">
                {lines.map((l) => (
                  <div key={l.name} className="quote-line">
                    <div className="quote-line-top">
                      <span className="quote-line-name">{withQty(l.name, l.qty)}</span>
                      <span className="quote-line-amount">{formatCurrency(num(l.rate) * l.qty)}</span>
                    </div>
                    <div className="quote-line-fields">
                      <DateField id={`q-date-${l.name}`} value={l.date} onChange={(v) => editLine(l.name, { date: v })} />
                      <input className="field-input" inputMode="numeric" value={l.rate} onChange={(e) => editLine(l.name, { rate: e.target.value })} placeholder="Rate ₹" aria-label={`Rate for ${l.name}`} />
                      <button type="button" className="icon-btn" onClick={() => setQty(l.name, 0)} aria-label={`Remove ${l.name}`}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
