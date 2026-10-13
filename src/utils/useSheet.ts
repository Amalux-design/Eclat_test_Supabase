import { useCallback, useRef, useState } from "react";

// Shared bottom-sheet close: the sheet slides down before it unmounts.

const CLOSE_MS = 300;

export function useSheet(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [closing, onClose]);

  return { closing, close, sheetRef };
}
