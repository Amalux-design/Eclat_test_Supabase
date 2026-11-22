import { useState } from "react";
import { ChevronRight, LockKeyhole, MapPin, PencilLine, Phone, Users, X } from "lucide-react";
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
  formatNumber,
  formatTime,
  isMapLink,
  mapsUrl,
  parseWorks,
  receivedOf,
  splitQty,
  telHref,
} from "../utils/format";

interface BookingSheetProps {
  log: WorkLog;
  onClose: () => void;
  /** Opens the booking form (the page owns it). */
  onEdit?: () => void;
}

/**
 * Everything about one booking, sliding up from the bottom. Used on every tab.
 * Reads top to bottom: who → when and where → services → payment → notes, photos → actions.
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
  const lines: { label: string; qty?: number; amount?: number; adjustment?: boolean }[] = itemised
    ? items
    : services.map((sv) => ({ label: sv.name, qty: sv.qty }));
  const day = new Date(`${log.date}T00:00:00`);

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
            {/* Who */}
            <div className="bs-head">
              <h3 className="bs-name">{log.clientName || "Unnamed client"}</h3>
              <div className="bs-pills">
                <StatusPill kind={log.status} />
                {log.eventType && <span className="bs-event">{log.eventType}</span>}
                {isAdmin && !log.own && <span className="booking-referral">via {log.referrerName || "referral"}</span>}
              </div>
            </div>

            {/* When and where: the one dark block, readable at a glance */}
            <div className="bs-slip">
              <div className="bs-slip-when">
                <time className="bs-date" dateTime={log.date}>
                  <span>{day.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                  <strong>{day.getDate()}</strong>
                  <span>
                    {day.toLocaleDateString("en-GB", { month: "short" })}
                    {day.getFullYear() !== new Date().getFullYear() && ` ${day.getFullYear()}`}
                  </span>
                </time>
                <dl className={`bs-times${log.startTime && log.endTime ? " two" : ""}`}>
                  {(log.startTime || !log.endTime) && (
                    <div>
                      <dt>{log.startTime ? "Starts" : "Time"}</dt>
                      <dd>{log.startTime ? formatTime(log.startTime) : "Any time"}</dd>
                    </div>
                  )}
                  {log.endTime && (
                    <div>
                      <dt>Ready by</dt>
                      <dd>{formatTime(log.endTime)}</dd>
                    </div>
                  )}
                </dl>
              </div>
              {log.location && (
                <a className="bs-slip-where" href={mapsUrl(log.location)} target="_blank" rel="noreferrer">
                  <MapPin size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span className="bs-where-text">{isMapLink(log.location) ? "Map link" : log.location}</span>
                  <span className="bs-directions">
                    Directions <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </a>
              )}
            </div>

            {/* What: quantities in their own column, amounts on the right */}
            {(services.length > 0 || log.bridesmaids > 0 || (isAdmin && log.amount > 0)) && (
              <section className="bs-section">
                {(services.length > 0 || log.bridesmaids > 0) && <h4 className="bs-label">Services</h4>}
                <ul className={`bs-receipt${lines.some((l) => (l.qty ?? 1) > 1) ? " has-qty" : ""}`}>
                  {lines.map((line, i) => (
                    <li key={`${line.label}-${i}`} className={line.adjustment ? "bs-adjust" : undefined}>
                      <span className="bs-qty">{(line.qty ?? 1) > 1 ? `${line.qty}×` : ""}</span>
                      <span className="bs-service">{line.label}</span>
                      {line.amount !== undefined &&
                        (line.qty != null && line.amount === 0 ? (
                          <span className="bs-included">Included</span>
                        ) : (
                          <span className="bs-num">
                            {line.amount < 0 ? `− ${formatNumber(-line.amount)}` : formatNumber(line.amount)}
                          </span>
                        ))}
                    </li>
                  ))}
                </ul>
                {log.bridesmaids > 0 && (
                  <p className="bs-party">
                    <Users size={17} strokeWidth={1.75} aria-hidden="true" />
                    {log.bridesmaids} bridesmaid{log.bridesmaids === 1 ? "" : "s"}
                  </p>
                )}
                {isAdmin && log.amount > 0 && (
                  <div className="bs-total">
                    <span>Total</span>
                    <span className="bs-num">{formatCurrency(log.amount)}</span>
                  </div>
                )}
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

            {log.notes && (
              <section className="bs-section">
                <h4 className="bs-label">Team notes</h4>
                <p className="bs-note">{log.notes}</p>
              </section>
            )}

            {isAdmin && log.privateNotes && (
              <section className="bs-section">
                <h4 className="bs-label">
                  Private notes
                  <span className="bs-label-aside">
                    <LockKeyhole size={13} strokeWidth={1.75} aria-hidden="true" /> Owner and admins
                  </span>
                </h4>
                <p className="bs-note">{log.privateNotes}</p>
              </section>
            )}

            {log.photos.length > 0 && (
              <section className="bs-section">
                <h4 className="bs-label">Reference photos</h4>
                <PhotoStrip photos={log.photos} />
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
