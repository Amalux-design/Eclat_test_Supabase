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
  return <span className={`pill pill-${kind.toLowerCase()}`}>{LABELS[kind]}</span>;
}
