import { Plus } from "lucide-react";

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <button className="fab" onClick={onClick} aria-label="Add log">
      <Plus size={26} strokeWidth={2.5} />
    </button>
  );
}
