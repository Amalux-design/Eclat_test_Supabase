import type { PaymentStatus, WorkStatus } from "../types";

interface StatusPillProps {
  kind: PaymentStatus | WorkStatus;
}

const LABELS: Record<string, string> = {
  PAID: "Paid",
  PENDING: "Pending",
  WORKED: "Worked",
  RESERVED: "Reserved",
};

const STYLES: Record<string, { bg: string; color: string }> = {
  PAID: { bg: "var(--color-success-bg)", color: "var(--color-success-text)" },
  PENDING: { bg: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
  WORKED: { bg: "var(--color-success-bg)", color: "var(--color-success-text)" },
  RESERVED: { bg: "var(--color-reserved-bg)", color: "var(--color-reserved-text)" },
};

export function StatusPill({ kind }: StatusPillProps) {
  const style = STYLES[kind];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: "var(--radius-full)",
        background: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
      }}
    >
      {LABELS[kind]}
    </span>
  );
}
