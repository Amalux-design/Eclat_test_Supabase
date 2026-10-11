import { formatCurrency } from "../utils/format";

interface PaymentSummaryCardProps {
  label: string;
  value: string;
  tint?: "default" | "success" | "warning";
}

export function PaymentSummaryCard({ label, value, tint = "default" }: PaymentSummaryCardProps) {
  const colorMap = {
    default: "var(--color-text)",
    success: "var(--color-success-text)",
    warning: "var(--color-warning-text)",
  };
  return (
    <div className="card summary-card">
      <div className="summary-label">{label}</div>
      <div className="summary-value" style={{ color: colorMap[tint] }}>
        {value}
      </div>
    </div>
  );
}

export function formatSummaryAmount(amount: number): string {
  return formatCurrency(amount);
}
