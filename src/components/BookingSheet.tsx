import { useState } from "react";
import { ChevronRight, FileText, LockKeyhole, MapPin, PencilLine, Phone, Users, X } from "lucide-react";
import type { WorkLog } from "../types";
import { Sheet } from "./Sheet";
import { StatusPill } from "./StatusPill";
import { PhotoStrip } from "./Photos";
import { MoreMenu } from "./MoreMenu";
import { useAuth } from "../context/AuthContext";
import { useLogs } from "../context/LogsContext";
import { useConfirm } from "./ConfirmDialog";
import { useNotice } from "./Notice";
import { lineItems } from "../utils/lineItems";
import {
  formatCurrency,
  formatDateShort,
  formatNumber,
  formatTime,
  isMapLink,
  mapsUrl,
  parseWorks,
  receivedOf,
  splitQty,
  telHref,
  withQty,
} from "../utils/format";

interface BookingSheetProps {
  log: WorkLog;
  onClose: () => void;
  /** Opens the booking form (the page owns it). */
  onEdit?: () => void;
}

/**
 * Everything about one booking, sliding up from the bottom. Used on every tab.
 * Reads top to bottom: who and when → where and notes → receipt → payment → actions.
 */
export function BookingSheet({ log: initial, onClose, onEdit }: BookingSheetProps) {
  const { isAdmin } = useAuth();
  const { logs, removeLog, recordPayment } = useLogs();
  const confirm = useConfirm();
  const notify = useNotice();
  const [payOpen, setPayOpen] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialValue, setPartialValue] = useState("");
  const [paying, setPaying] = useState(false);
  // The booking as it was when the amount was started: a retry never adds on top of itself.
  const [payFrom, setPayFrom] = useState<WorkLog | null>(null);

  // Always show the latest saved version (edits and payments land live).
  const log = logs.find((l) => l.id === initial.id) ?? initial;
  const received = receivedOf(log);
  const balance = log.amount - received;

  // Receipt: the same lines as the invoice PDF. Itemised only when they explain
  // the total (several services with menu prices); otherwise just the names.
  const services = parseWorks(log.work).map(splitQty);
  const items = lineItems(log);
  const itemised = isAdmin && log.amount > 0 && items.some((it) => it.qty != null);
  const paidShare = log.amount > 0 ? Math.min(1, Math.max(0, received / log.amount)) : 0;
  const hasFacts = !!log.location || log.bridesmaids > 0 || !!log.notes || (isAdmin && !!log.privateNotes);

  async function remove(close: () => void) {
    const ok = await confirm({
      title: "Delete booking?",
      message: `${log.clientName || "This booking"} will be removed for everyone, including assistants.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeLog(log.id);
      close();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't delete. Try again.", "error");
    }
  }

  /** Save a payment (add = null: the full total), asking first if the money changed meanwhile. */
  async function pay(seen: WorkLog, add: number | null) {
    let from = seen;
    for (;;) {
      const was = receivedOf(from);
      let changed: WorkLog | null;
      setPaying(true);
      try {
        changed = await recordPayment(from, add === null ? Math.max(from.amount, was) : was + add);
      } catch (err) {
        notify(err instanceof Error ? err.message : "Couldn't save. Try again.", "error");
        return;
      } finally {
        setPaying(false);
      }
      if (!changed) return closePay();

      const now = receivedOf(changed);
      if (add === null && changed.amount > 0 && now >= changed.amount) {
        notify("Already paid in full. Nothing was added.");
        return closePay();
      }
      const ok = await confirm(
        now !== was && add !== null
          ? {
              title: `Add another ${formatCurrency(add)}?`,
              message: `Received changed from ${formatCurrency(was)} to ${formatCurrency(now)}. If that was this payment, it's already saved. Adding makes it ${formatCurrency(now + add)}.`,
              confirmLabel: "Add",
              cancelLabel: "Don't add",
            }
          : {
              title: "This booking changed",
              message: `The total is now ${formatCurrency(changed.amount)}, with ${formatCurrency(now)} received. Record ${formatCurrency(add === null ? changed.amount : now + add)} as received in all?`,
              confirmLabel: "Record",
            }
      );
      if (!ok) return closePay();
      from = changed;
    }
  }

  async function payFull() {
    const seen = log; // save exactly what the question showed
    const ok = await confirm({
      title: "Mark as fully paid?",
      message: `${seen.clientName || "This booking"} will show ${formatCurrency(seen.amount)} received.`,
      confirmLabel: "Mark paid",
    });
    if (ok) await pay(seen, null);
  }

  function closePay() {
    setPayOpen(false);
    setPartialOpen(false);
    setPartialValue("");
    setPayFrom(null);
  }

  return (
    <Sheet label={`Booking: ${log.clientName || "client"}`} onClose={onClose}>
      {(close) => (
        <>
          {/* Handle strip (drag down to close). The close button rides in it, beside the
              name, and stays in reach while the sheet scrolls. */}
          <div className="modal-header bs-bar">
            <button className="icon-btn bs-close" onClick={close} aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div className="modal-body booking-sheet">
            {/* Who and when */}
            <div className="bs-head">
              <h3 className="bs-name">{log.clientName || "Unnamed client"}</h3>
              <p className="bs-when">
                {formatDateShort(log.date, "auto")} · {log.startTime ? formatTime(log.startTime) : "Any time"}
                {log.endTime && <> → ready {formatTime(log.endTime)}</>}
              </p>
              <div className="bs-pills">
                <StatusPill kind={log.status} />
                {isAdmin && !log.own && <span className="booking-referral">via {log.referrerName || "referral"}</span>}
              </div>
            </div>

            {/* Where, who else, notes: one quiet list */}
            {hasFacts && (
              <ul className="bs-facts">
                {log.location && (
                  <li>
                    <a className="bs-fact bs-fact-link" href={mapsUrl(log.location)} target="_blank" rel="noreferrer">
                      <MapPin size={18} strokeWidth={1.75} aria-hidden="true" />
                      <span className="bs-fact-text">{isMapLink(log.location) ? "Open in Maps" : log.location}</span>
                      <ChevronRight size={18} strokeWidth={1.75} className="bs-fact-go" aria-hidden="true" />
                    </a>
                  </li>
                )}
                {log.bridesmaids > 0 && (
                  <li className="bs-fact">
                    <Users size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className="bs-fact-text">
                      {log.bridesmaids} bridesmaid{log.bridesmaids === 1 ? "" : "s"}
                    </span>
                  </li>
                )}
                {log.notes && (
                  <li className="bs-fact">
                    <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className="bs-fact-text">{log.notes}</span>
                  </li>
                )}
                {isAdmin && log.privateNotes && (
                  <li className="bs-fact bs-fact-private">
                    <LockKeyhole size={17} strokeWidth={1.75} aria-label="Only admins see this" />
                    <span className="bs-fact-text">{log.privateNotes}</span>
                  </li>
                )}
              </ul>
            )}

            {/* Receipt */}
            {(services.length > 0 || log.eventType) && (
              <section className="bs-section">
                <h4 className="bs-label">{log.eventType || "Services"}</h4>
                {services.length > 0 && (
                  <ul className="bs-receipt">
                    {itemised
                      ? items.map((it, i) => {
                          const included = it.qty != null && it.amount === 0;
                          return (
                            <li key={`${it.label}-${i}`} className={it.adjustment ? "bs-adjust" : undefined}>
                              <span>{it.qty != null ? withQty(it.label, it.qty) : it.label}</span>
                              <span className={included ? "bs-included" : "bs-num"}>
                                {included
                                  ? "Included"
                                  : it.amount < 0
                                    ? `− ${formatNumber(-it.amount)}`
                                    : formatNumber(it.amount)}
                              </span>
                            </li>
                          );
                        })
                      : services.map((sv, i) => (
                          <li key={`${sv.name}-${i}`}>
                            <span>{withQty(sv.name, sv.qty)}</span>
                          </li>
                        ))}
                  </ul>
                )}
                {isAdmin && log.amount > 0 && (
                  <div className="bs-total">
                    <span>Total</span>
                    <span className="bs-num">{formatCurrency(log.amount)}</span>
                  </div>
                )}
              </section>
            )}

            {log.photos.length > 0 && (
              <section className="bs-section">
                <h4 className="bs-label">Reference photos</h4>
                <PhotoStrip photos={log.photos} />
              </section>
            )}

            {/* Payment: a thin gold bar, one line, one button */}
            {isAdmin && (log.amount > 0 || received > 0) && (
              <section className="bs-pay" aria-label="Payment">
                <div
                  className="bs-progress"
                  role="progressbar"
                  aria-label="Paid so far"
                  aria-valuemin={0}
                  aria-valuemax={log.amount}
                  aria-valuenow={Math.min(received, log.amount)}
                >
                  <span style={{ width: `${paidShare * 100}%` }} />
                </div>
                <div className="bs-pay-line">
                  <span>{formatCurrency(received)} received</span>
                  {balance > 0 ? (
                    <span className="bs-due">{formatCurrency(balance)} due</span>
                  ) : log.amount === 0 ? (
                    <span>Total not set</span>
                  ) : balance < 0 ? (
                    <span className="bs-due">{formatCurrency(-balance)} to refund</span>
                  ) : (
                    <span className="bs-paid">Paid in full</span>
                  )}
                </div>

                {balance > 0 &&
                  (!payOpen ? (
                    <button type="button" className="primary-btn" onClick={() => setPayOpen(true)}>
                      Record payment
                    </button>
                  ) : (
                    <div className="bs-pay-choice">
                      <div className="bs-pay-options">
                        <button type="button" className="bs-action primary" disabled={paying} onClick={() => void payFull()}>
                          Full {formatCurrency(balance)}
                        </button>
                        <button
                          type="button"
                          className={`bs-action${partialOpen ? " is-on" : ""}`}
                          aria-expanded={partialOpen}
                          onClick={() => setPartialOpen((v) => !v)}
                        >
                          Other amount
                        </button>
                      </div>
                      {partialOpen && (
                        <form
                          className="partial-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const add = Number(partialValue);
                            if (paying || !add || add <= 0) return;
                            void pay(payFrom ?? log, add);
                          }}
                        >
                          <label className="field-label" htmlFor="bs-partial">Amount received now</label>
                          <div className="partial-row">
                            <input
                              id="bs-partial"
                              type="number"
                              inputMode="numeric"
                              min="1"
                              max={balance}
                              autoFocus
                              className="field-input"
                              value={partialValue}
                              disabled={paying}
                              onChange={(e) => {
                                if (!partialValue) setPayFrom(log);
                                setPartialValue(e.target.value);
                              }}
                              placeholder={`Up to ${formatCurrency(balance)}`}
                            />
                            <button type="submit" className="save-pill" disabled={paying || !Number(partialValue)}>
                              {paying ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </form>
                      )}
                      <button type="button" className="text-btn bs-pay-cancel" disabled={paying} onClick={closePay}>
                        Cancel
                      </button>
                    </div>
                  ))}
              </section>
            )}

            {isAdmin && (
              <div className="bs-actions">
                {log.clientPhone && (
                  <a href={telHref(log.clientPhone)} className="bs-action primary">
                    <Phone size={17} strokeWidth={1.8} /> Call
                  </a>
                )}
                {onEdit && (
                  <button
                    type="button"
                    className="bs-action"
                    onClick={() => {
                      close();
                      onEdit();
                    }}
                  >
                    <PencilLine size={17} strokeWidth={1.8} /> Edit
                  </button>
                )}
                <MoreMenu log={log} onDelete={() => void remove(close)} />
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
