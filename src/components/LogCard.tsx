import { useState } from "react";
import { ChevronRight, Images, Phone } from "lucide-react";
import type { WorkLog } from "../types";
import { StatusPill } from "./StatusPill";
import { BookingSheet } from "./BookingSheet";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatTime, isPartPaid, parseWorks, telHref, workLabel } from "../utils/format";

interface LogCardProps {
  log: WorkLog;
  /** Kept for older call sites; deleting now lives in the details sheet. */
  onDelete?: () => void;
  /** Opens the booking form (from the details sheet). */
  onEdit?: () => void;
  /** Show a short date above the time, for lists that span several days. */
  dateLabel?: string;
  tone?: "paper" | "wine";
}

/**
 * Compact booking preview: time, name, price, a one-line service summary,
 * badges, a photo hint and Call. Tap anywhere to open the full details sheet.
 */
export function LogCard({ log, onEdit, dateLabel, tone = "paper" }: LogCardProps) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const services = parseWorks(log.work).map(workLabel);
  const summary = services.length ? services.join(", ") : log.eventType ?? "";
  const event = services.length > 0 && log.eventType ? ` for ${log.eventType.toLowerCase()}` : "";

  return (
    <>
      <article
        className={`booking booking-${tone} booking-compact is-interactive booking-${log.status.toLowerCase()}`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open booking for ${log.clientName || "client"}`}
      >
        <div className="booking-time">
          {dateLabel && <span className="booking-date">{dateLabel}</span>}
          <span className="booking-start">{log.startTime ? formatTime(log.startTime) : "Any time"}</span>
          {log.endTime && (
            <span className="booking-ready">
              <span className="booking-ready-label">Ready</span>
              <span>{formatTime(log.endTime)}</span>
            </span>
          )}
          {isAdmin && log.clientPhone && (
            <a
              href={telHref(log.clientPhone)}
              className="round-btn booking-call"
              aria-label={`Call ${log.clientName || "client"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Phone size={15} strokeWidth={1.75} />
            </a>
          )}
        </div>

        <div className="booking-body">
          <div className="booking-head">
            <h3 className="booking-client">{log.clientName || "Unnamed client"}</h3>
            {isAdmin && log.amount > 0 && <span className="booking-amount">{formatCurrency(log.amount)}</span>}
          </div>

          {(summary || log.photos.length > 0) && (
            <div className="booking-summary-row">
              <p className="booking-services booking-summary">
                {summary}
                {event && <span className="booking-event">{event}</span>}
              </p>
              {log.photos.length > 0 && (
                <span className="booking-photo-hint" aria-label={`${log.photos.length} reference photos`}>
                  <Images size={15} strokeWidth={1.75} />
                  {log.photos.length}
                </span>
              )}
            </div>
          )}

          <div className="booking-foot">
            <StatusPill kind={log.status} />
            {isAdmin &&
              (isPartPaid(log) ? (
                <span className="pill pill-partial">Part paid</span>
              ) : (
                <StatusPill kind={log.paymentStatus} />
              ))}

          </div>
        </div>
        <ChevronRight size={20} strokeWidth={1.75} className="booking-chevron" aria-hidden="true" />
      </article>
      {open && <BookingSheet log={log} onClose={() => setOpen(false)} onEdit={onEdit} />}
    </>
  );
}
