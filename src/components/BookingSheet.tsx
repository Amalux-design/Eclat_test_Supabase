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
  formatDateLong,
  formatTime,
  isMapLink,
  isPartPaid,
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

/** Everything about one booking, sliding up from the bottom. Used on every tab. */
export function BookingSheet({ log: initial, onClose, onEdit }: BookingSheetProps) {
  const { isAdmin } = useAuth();
  const { logs, removeLog, markPaid, recordPayment } = useLogs();
  const confirm = useConfirm();
  const notify = useNotice();
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialValue, setPartialValue] = useState("");

  // Always show the latest saved version (edits and payments land live).
  const log = logs.find((l) => l.id === initial.id) ?? initial;
  const services = parseWorks(log.work).map(splitQty);
  const received = receivedOf(log);
  const balance = log.amount - received;

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

  return (
    <Sheet label={`Booking: ${log.clientName || "client"}`} onClose={onClose}>
      {(close) => (
        <>
          <div className="modal-header">
            <span />
            <h2 className="modal-title">Booking</h2>
            <button className="icon-btn" onClick={close} aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div className="modal-body booking-sheet">
            <div className="bs-head">
              <div>
                <h3 className="bs-name">{log.clientName || "Unnamed client"}</h3>
                <p className="bs-when">
                  {formatDateLong(log.date)} · {log.startTime ? formatTime(log.startTime) : "Any time"}
                  {log.endTime && <> · ready {formatTime(log.endTime)}</>}
                </p>
              </div>
              {isAdmin && log.amount > 0 && <span className="bs-amount">{formatCurrency(log.amount)}</span>}
            </div>

            <div className="bs-pills">
              <StatusPill kind={log.status} />
              {isAdmin &&
                (isPartPaid(log) ? (
                  <span className="pill pill-partial">
                    Part paid {formatCurrency(log.paidAmount)} of {formatCurrency(log.amount)}
                  </span>
                ) : (
                  <StatusPill kind={log.paymentStatus} />
                ))}
              {isAdmin && !log.own && <span className="booking-referral">via {log.referrerName || "referral"}</span>}
            </div>


            {(services.length > 0 || log.eventType) && (
              <section className="bs-section">
                <h4 className="bs-label">{log.eventType ? `Services for ${log.eventType.toLowerCase()}` : "Services"}</h4>
                <ul className="bs-services">
                  {services.map((s, i) => {
                    const rate = servicePrice(s.name) ?? s.price ?? 0;
                    return (
                      <li key={`${s.name}-${i}`}>
                        <span>{withQty(s.name, s.qty)}</span>
                        {isAdmin && rate > 0 && <span className="bs-rate">{formatCurrency(rate * s.qty)}</span>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {(log.location || log.bridesmaids > 0) && (
              <section className="bs-section bs-meta">
                {log.location && (
                  <a className="booking-location" href={mapsUrl(log.location)} target="_blank" rel="noreferrer">
                    <MapPin size={18} strokeWidth={1.75} />
                    <span>{isMapLink(log.location) ? "Open in Maps" : log.location}</span>
                    <ChevronRight size={18} strokeWidth={1.75} className="booking-location-go" aria-hidden="true" />
                  </a>
                )}
                {log.bridesmaids > 0 && (
                  <span className="booking-bridesmaids">
                    <Users size={18} strokeWidth={1.75} />
                    {log.bridesmaids} bridesmaid{log.bridesmaids === 1 ? "" : "s"}
                  </span>
                )}
              </section>
            )}

            {log.notes && (
              <p className="booking-notes">
                <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>{log.notes}</span>
              </p>
            )}

            {isAdmin && log.privateNotes && (
              <p className="booking-private">
                <LockKeyhole size={16} strokeWidth={1.75} />
                <span>{log.privateNotes}</span>
              </p>
            )}

            {log.photos.length > 0 && (
              <section className="bs-section">
                <h4 className="bs-label">Reference photos</h4>
                <PhotoStrip photos={log.photos} />
              </section>
            )}

            {isAdmin && log.amount > 0 && (
              <section className="bs-section bs-pay">
                <h4 className="bs-label">Payment</h4>
                <div className="pay-summary">
                  <span>Received {formatCurrency(received)}</span>
                  {balance > 0 ? <span className="due">Balance {formatCurrency(balance)}</span> : <span>Paid in full</span>}
                </div>
                {balance > 0 && (
                  <>
                    <button
                      className="primary-btn"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Mark as fully paid?",
                          message: `${log.clientName || "This booking"} will show ${formatCurrency(log.amount)} received.`,
                          confirmLabel: "Mark paid",
                        });
                        if (!ok) return;
                        try {
                          await markPaid(log.id);
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "Couldn't save. Try again.", "error");
                        }
                      }}
                    >
                      Mark {formatCurrency(balance)} as paid
                    </button>
                    {!partialOpen ? (
                      <button className="ghost-btn full" onClick={() => setPartialOpen(true)}>
                        Mark partial
                      </button>
                    ) : (
                      <form
                        className="partial-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const add = Number(partialValue);
                          if (!add || add <= 0) return;
                          try {
                            await recordPayment(log.id, received + add);
                            setPartialOpen(false);
                            setPartialValue("");
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
                  </>
                )}
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
