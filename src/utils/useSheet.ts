import { useCallback, useRef, useState } from "react";

// Bottom-sheet behaviour shared by every sheet: slide out on close, and drag
// the sheet down to dismiss. The drag only starts from the top of the sheet
// (or when its content is scrolled to the top), so inner scrolling still works.

const CLOSE_MS = 300;

export function useSheet(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number; active: boolean } | null>(null);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [closing, onClose]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const sheet = sheetRef.current;
    if (!sheet || e.pointerType === "mouse") return;
    const fromTop = e.clientY - sheet.getBoundingClientRect().top;
    const target = e.target as HTMLElement;
    // Grab bar / header zone, or anywhere once the content is at its top.
    const onHandle = fromTop < 64 && !target.closest("button, input, textarea, select, a");
    if (!onHandle && sheet.scrollTop > 0) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, active: onHandle };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    const dy = e.clientY - d.y;
    if (!d.active) {
      // Content area: only take over a clear downward pull from the top.
      if (dy < 10 || sheet.scrollTop > 0) {
        if (dy < -4) drag.current = null;
        return;
      }
      d.active = true;
    }
    d.dy = Math.max(0, dy);
    sheet.classList.add("sheet-dragging");
    sheet.style.transform = `translate3d(0, ${d.dy}px, 0)`;
  }, []);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    const sheet = sheetRef.current;
    if (!d || !d.active || !sheet) return;
    const velocity = d.dy / Math.max(performance.now() - d.t, 1);
    sheet.classList.remove("sheet-dragging");
    if (d.dy > Math.min(160, sheet.offsetHeight * 0.3) || velocity > 0.6) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)";
      sheet.style.transform = "translate3d(0, 100%, 0)";
      setClosing(true);
      window.setTimeout(onClose, 280);
    } else {
      sheet.style.transition = "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)";
      sheet.style.transform = "";
      window.setTimeout(() => {
        if (sheet) sheet.style.transition = "";
      }, 400);
    }
  }, [onClose]);

  return {
    closing,
    close,
    sheetRef,
    sheetHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
