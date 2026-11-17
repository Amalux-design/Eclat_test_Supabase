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
import { servicePrice } from "../data/services";
import {
  formatCurrency,
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

/** "Tue, 13 Oct" (with the year when it isn't this year). */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Receipt figures: digits only; the ₹ sits on the total. */
function figure(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Everything about one booking, sliding up from the bottom. Used on every tab.
 * Reads top to bottom: who and when → where and notes → receipt → payment → actions.
 */
export function BookingSheet({ log: initial, onClose, onEdit }: BookingSheetProps) {
  const { isAdmin } = useAuth();
  const { logs, removeLog, markPaid, recordPayment } = useLogs();
  const confirm = useConfirm();
  const notify = useNotice();
  const [payOpen, setPayOpen] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialValue, setPartialValue] = useState("");

  // Always show the latest saved version (edits and payments land live).
  const log = logs.find((l) => l.id === initial.id) ?? initial;
  const received = receivedOf(log);
  const balance = log.amount - received;

  // Receipt: menu price per service; a gap to the booked total shows as one adjustment line.
  const rows = parseWorks(log.work)
    .map(splitQty)
    .map((s) => ({ ...s, rate: servicePrice(s.name) ?? s.price ?? 0 }));
  const menuTotal = rows.reduce((sum, r) => sum + r.rate * r.qty, 0);
  const priced = menuTotal > 0;
  const adjust = priced && log.amount > 0 ? log.amount - menuTotal : 0;
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

  async function payFull() {
    const ok = await confirm({
      title: "Mark as fully paid?",
      message: `${log.clientName || "This booking"} will show ${formatCurrency(log.amount)} received.`,
      confirmLabel: "Mark paid",
    });
    if (!ok) return;
    try {
      await markPaid(log.id);
      setPayOpen(false);
      setPartialOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't save. Try again.", "error");
    }
  }

  function closePay() {
    setPayOpen(false);
    setPartialOpen(false);
    setPartialValue("");
  }

  return (
    <Sheet label={`Booking: ${log.clientName || "client"}`} onClose={onClose}>
      {(close) => (
        <>
          {/* Handle strip only (drag down to close); the close button sits beside the name. */}
          <div className="modal-header bs-bar" />

          <div className="modal-body booking-sheet">
            {/* Who and when */}
            <div className="bs-head">
              <button className="icon-btn bs-close" onClick={close} aria-label="Close">
                <X size={20} />
              </button>
              <h3 className="bs-name">{log.clientName || "Unnamed client"}</h3>
              <p className="bs-when">
                {shortDate(log.date)} · {log.startTime ? formatTime(log.startTime) : "Any time"}
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
            {(rows.length > 0 || log.eventType) && (
              <section className="bs-section">
                <h4 className="bs-label">{log.eventType || "Services"}</h4>
                {rows.length > 0 && (
                  <ul className="bs-receipt">
                    {rows.map((r, i) => (
                      <li key={`${r.name}-${i}`}>
                        <span>{withQty(r.name, r.qty)}</span>
                        {isAdmin && priced && (
                          <span className={r.rate > 0 ? "bs-num" : "bs-included"}>
                            {r.rate > 0 ? figure(r.rate * r.qty) : "Included"}
                          </span>
                        )}
                      </li>
                    ))}
                    {isAdmin && adjust !== 0 && (
                      <li className="bs-adjust">
                        <span>{adjust > 0 ? "Additional" : "Discount"}</span>
                        <span className="bs-num">{adjust > 0 ? figure(adjust) : `− ${figure(-adjust)}`}</span>
                      </li>
                    )}
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
            {isAdmin && log.amount > 0 && (
              <section className="bs-pay" aria-label="Payment">
                <div
                  className="bs-progress"
                  role="progressbar"
                  aria-label="Paid so far"
                  aria-valuemin={0}
                  aria-valuemax={log.amount}
                  aria-valuenow={received}
                >
                  <span style={{ width: `${paidShare * 100}%` }} />
                </div>
                <div className="bs-pay-line">
                  <span>{formatCurrency(received)} received</span>
                  {balance > 0 ? (
                    <span className="bs-due">{formatCurrency(balance)} due</span>
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
                        <button type="button" className="bs-action primary" onClick={() => void payFull()}>
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
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const add = Number(partialValue);
                            if (!add || add <= 0) return;
                            try {
                              await recordPayment(log.id, received + add);
                              closePay();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : "Couldn't save. Try again.", "error");
                            }
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
                              onChange={(e) => setPartialValue(e.target.value)}
                              placeholder={`Up to ${formatCurrency(balance)}`}
                            />
                            <button type="submit" className="save-pill" disabled={!Number(partialValue)}>
                              Save
                            </button>
                          </div>
                        </form>
                      )}
                      <button type="button" className="text-btn bs-pay-cancel" onClick={closePay}>
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
