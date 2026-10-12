import { Plus } from "lucide-react";

interface FABProps {
  onClick: () => void;
  label?: string;
}

export function FAB({ onClick, label = "New" }: FABProps) {
  return (
    <button className="fab" onClick={onClick} aria-label="New booking">
      <Plus size={18} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}
