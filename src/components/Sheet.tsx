import type { ReactNode } from "react";
import { useSheet } from "../utils/useSheet";

interface SheetProps {
  label: string;
  onClose: () => void;
  /** Receives `close`, which slides the sheet away before unmounting. */
  children: (close: () => void) => ReactNode;
}

/** Bottom sheet that slides away when closed. */
export function Sheet({ label, onClose, children }: SheetProps) {
  const { closing, close, sheetRef } = useSheet(onClose);
  return (
    <div className={`modal-overlay ${closing ? "closing" : ""}`} onClick={close}>
      <div
        ref={sheetRef}
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={label}
      >
        {children(close)}
      </div>
    </div>
  );
}
