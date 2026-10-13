import type { ReactNode } from "react";
import { useSheet } from "../utils/useSheet";

interface SheetProps {
  label: string;
  onClose: () => void;
  /** Receives `close`, which slides the sheet away before unmounting. */
  children: (close: () => void) => ReactNode;
}

/** Bottom sheet with slide-out close and drag-down to dismiss. */
export function Sheet({ label, onClose, children }: SheetProps) {
  const { closing, close, sheetRef, sheetHandlers } = useSheet(onClose);
  return (
    <div className={`modal-overlay ${closing ? "closing" : ""}`} onClick={close}>
      <div
        ref={sheetRef}
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={label}
        {...sheetHandlers}
      >
        {children(close)}
      </div>
    </div>
  );
}
