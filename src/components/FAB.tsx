import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

interface FABProps {
  onClick: () => void;
  label?: string;
}

// Rendered straight into <body>: anything animating on the page (the tab
// entrance) would otherwise become its positioning frame and make it jump.
export function FAB({ onClick, label = "New" }: FABProps) {
  return createPortal(
    <button className="fab" onClick={onClick} aria-label="New booking">
      <Plus size={16} strokeWidth={2.2} />
      <span>{label}</span>
    </button>,
    document.body
  );
}
