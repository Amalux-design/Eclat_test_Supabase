import { CalendarDays, Check, CheckCheck, Clock } from "lucide-react";
import type { PaymentStatus, WorkStatus } from "../types";

interface StatusPillProps {
  kind: PaymentStatus | WorkStatus;
}

const LABELS: Record<string, string> = {
  PAID: "Paid",
  PENDING: "Payment due",
  WORKED: "Done",
  RESERVED: "Booked",
};

export function StatusPill({ kind }: StatusPillProps) {
  return (
    <span className={`pill pill-${kind.toLowerCase()}`}>
      {kind === "PAID" && (
        <span className="pill-tick" aria-hidden="true">
          <Check size={11} strokeWidth={3.2} />
        </span>
      )}
      {kind === "RESERVED" && <CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" />}
      {kind === "WORKED" && <CheckCheck size={16} strokeWidth={1.75} aria-hidden="true" />}
      {kind === "PENDING" && <Clock size={16} strokeWidth={1.75} aria-hidden="true" />}
      {LABELS[kind]}
    </span>
  );
}
