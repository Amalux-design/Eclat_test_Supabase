import { X } from "lucide-react";
import type { WorkLog } from "../types";
import { LogCard } from "./LogCard";
import { formatDateHeading } from "../utils/format";

interface DaySheetProps {
  date: string;
  logs: WorkLog[];
  onClose: () => void;
  onAddWork: () => void;
  onOpenLog: (log: WorkLog) => void;
  onConvertToWorked: (log: WorkLog) => void;
}

export function DaySheet({ date, logs, onClose, onAddWork, onOpenLog, onConvertToWorked }: DaySheetProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{formatDateHeading(date)}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {logs.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-title">Nothing booked</div>
              <div>This date is free.</div>
              <button className="primary-btn" onClick={onAddWork} style={{ marginTop: 20 }}>
                Add work or reservation
              </button>
            </div>
          )}

          {logs.map((log) => (
            <div key={log.id}>
              <LogCard log={log} onClick={() => onOpenLog(log)} />
              {log.status === "RESERVED" && (
                <button
                  className="primary-btn secondary"
                  style={{ marginTop: -4, marginBottom: 16 }}
                  onClick={() => onConvertToWorked(log)}
                >
                  Mark as worked
                </button>
              )}
            </div>
          ))}

          {logs.length > 0 && onAddWork && (
            <button className="primary-btn" onClick={onAddWork}>
              + Add another work
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
