import { Phone, Trash2 } from "lucide-react";
import type { WorkLog } from "../types";
import { StatusPill } from "./StatusPill";
import { formatCurrency, formatTime, parseWorks } from "../utils/format";

interface LogCardProps {
  log: WorkLog;
  onClick: () => void;
  onDelete?: () => void;
}

export function LogCard({ log, onClick, onDelete }: LogCardProps) {
  return (
    <div
      className="card"
      style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10, cursor: "pointer" }}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{log.clientName || log.work}</div>
        {log.clientPhone && (
          <div className="call-row">
            <span className="call-number">{log.clientPhone}</span>
            <a
              href={`tel:${log.clientPhone.replace(/[^\d+]/g, "")}`}
              className="call-btn"
              aria-label={`Call ${log.clientName || "client"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Phone size={14} />
            </a>
          </div>
        )}
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
          {[
            log.clientName ? null : "No client name",
            log.eventType || null,
            log.qty > 1 ? `${log.qty} × ${formatCurrency(log.price)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || " "}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {parseWorks(log.work).map((w) => (
            <span key={w} className="work-pill">
              {w}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <StatusPill kind={log.status} />
          <StatusPill kind={log.paymentStatus} />
          <span className="own-tag">
            {log.own ? "Direct" : log.referrerName ? `Referred · ${log.referrerName}` : "Referred"}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{formatCurrency(log.amount)}</div>
        {log.startTime && (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
            {formatTime(log.startTime)}
          </div>
        )}
        {onDelete && (
          <button
            aria-label="Delete log"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              marginTop: 10,
              background: "none",
              border: "none",
              padding: 8,
              color: "var(--color-text-secondary)",
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
