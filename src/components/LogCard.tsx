import { FileDown, LockKeyhole, MapPin, PencilLine, Phone, Trash2, Users } from "lucide-react";
import { saveInvoice } from "../utils/invoice";
import type { WorkLog } from "../types";
import { StatusPill } from "./StatusPill";
import { PhotoStrip } from "./Photos";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatTime, isMapLink, isPartPaid, mapsUrl, parseWorks, telHref } from "../utils/format";

interface LogCardProps {
  log: WorkLog;
  onClick?: () => void;
  onDelete?: () => void;
  /** Admin-only Edit pill; viewing a booking never opens the form by itself. */
  onEdit?: () => void;
  /** Show a short date above the time, for lists that span several days. */
  dateLabel?: string;
  tone?: "paper" | "wine";
}

export function LogCard({ log, onClick, onDelete, onEdit, dateLabel, tone = "paper" }: LogCardProps) {
  const { isAdmin } = useAuth();
  const services = parseWorks(log.work);
  const interactive = Boolean(onClick);

  return (
    <article
      className={`booking booking-${tone} ${interactive ? "is-interactive" : ""} booking-${log.status.toLowerCase()}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className="booking-time">
        {dateLabel && <span className="booking-date">{dateLabel}</span>}
        <span className="booking-start">{log.startTime ? formatTime(log.startTime) : "Any time"}</span>
        {log.endTime && <span className="booking-ready">ready {formatTime(log.endTime)}</span>}
      </div>

      <div className="booking-body">
        <div className="booking-head">
          <h3 className="booking-client">{log.clientName || "Unnamed client"}</h3>
          {isAdmin && log.amount > 0 && <span className="booking-amount">{formatCurrency(log.amount)}</span>}
        </div>

        {(services.length > 0 || log.eventType) && (
          <p className="booking-services">
            {services.length > 0 ? services.join(", ") : log.eventType}
            {services.length > 0 && log.eventType && (
              <span className="booking-event"> for {log.eventType.toLowerCase()}</span>
            )}
          </p>
        )}

        {(log.location || log.bridesmaids > 0) && (
          <div className="booking-meta">
            {log.location && (
              <a
                className="booking-location"
                href={mapsUrl(log.location)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin size={14} strokeWidth={1.6} />
                <span>{isMapLink(log.location) ? "Open in Maps" : log.location}</span>
              </a>
            )}
            {log.bridesmaids > 0 && (
              <span className="booking-bridesmaids">
                <Users size={14} strokeWidth={1.6} />
                {log.bridesmaids} bridesmaid{log.bridesmaids === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}

        {log.notes && <p className="booking-notes">{log.notes}</p>}

        <PhotoStrip photos={log.photos} />

        {isAdmin && log.privateNotes && (
          <p className="booking-private">
            <LockKeyhole size={13} strokeWidth={1.8} />
            <span>{log.privateNotes}</span>
          </p>
        )}

        {isAdmin && (
          <div className="booking-admin">
            <StatusPill kind={log.status} />
            {isPartPaid(log) ? (
              <span className="pill pill-partial">
                Part paid {formatCurrency(log.paidAmount)} of {formatCurrency(log.amount)}
              </span>
            ) : (
              <StatusPill kind={log.paymentStatus} />
            )}
            {!log.own && <span className="booking-referral">via {log.referrerName || "referral"}</span>}
            <span className="booking-admin-actions">
              {log.clientPhone && (
                <a
                  href={telHref(log.clientPhone)}
                  className="round-btn"
                  aria-label={`Call ${log.clientName || "client"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone size={15} strokeWidth={1.6} />
                </a>
              )}
              <button
                className="round-btn"
                aria-label={`Save invoice for ${log.clientName || "this booking"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void saveInvoice(log);
                }}
              >
                <FileDown size={15} strokeWidth={1.6} />
              </button>
              {onDelete && (
                <button
                  className="round-btn danger"
                  aria-label="Delete booking"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 size={15} strokeWidth={1.6} />
                </button>
              )}
              {onEdit && (
                <button
                  className="round-btn edit-pill"
                  aria-label={`Edit booking for ${log.clientName || "this client"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <PencilLine size={16} strokeWidth={1.7} />
                </button>
              )}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
