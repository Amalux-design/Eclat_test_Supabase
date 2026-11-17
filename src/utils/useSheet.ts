import { useCallback, useEffect, useRef, useState } from "react";

// Shared bottom sheet: slides down before it unmounts, and on phones and
// tablets it can be dragged down to close (from the handle, the header, or
// anywhere once the content is scrolled to the top), like an iOS sheet.

const CLOSE_MS = 300;
const DISMISS_PX = 110; // drag at least this far…
const DISMISS_SPEED = 0.6; // …or flick faster than this (px per ms)
const EASE = "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)";

export function useSheet(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), CLOSE_MS);
  }, []);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const overlay = sheet.parentElement;
    // Laptops show a centred dialog: no dragging there.
    const desktop = window.matchMedia("(min-width: 1024px)");

    let startY = 0;
    let samples: { y: number; t: number }[] = []; // recent finger positions, for flick speed
    let dy = 0;
    let tracking = false; // finger down, direction not decided yet
    let dragging = false;
    let fromHeader = false;

    /** True when the touch is inside something already scrolled down (it should scroll, not drag). */
    const scrolledInside = (target: EventTarget | null): boolean => {
      for (let el = target as HTMLElement | null; el && el !== overlay; el = el.parentElement) {
        if (el.scrollTop > 0) return true;
        if (el === sheet) break;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (desktop.matches || closingRef.current || e.touches.length !== 1) return;
      fromHeader = !!(e.target as HTMLElement).closest?.(".modal-header");
      if (!fromHeader && scrolledInside(e.target)) return;
      tracking = true;
      dragging = false;
      startY = e.touches[0].clientY;
      samples = [];
      dy = 0;
    };

    // Only transform (sheet) and opacity (dim layer) change while dragging:
    // both run on the compositor, written once per frame.
    let frame = 0;
    let height = 1;
    const paint = () => {
      frame = 0;
      sheet.style.transform = `translate3d(0, ${dy}px, 0)`;
      overlay?.style.setProperty("--dim", String(Math.max(0, 1 - dy / height)));
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const y = e.touches[0].clientY;
      if (!dragging) {
        const d = y - startY;
        if (d === 0) return;
        // Moving up (or content scrolled meanwhile) → let the sheet scroll normally.
        if (d < 0 || (!fromHeader && sheet.scrollTop > 0)) {
          tracking = false;
          return;
        }
        // Take over on the first downward move, before the browser starts
        // its own overscroll bounce.
        dragging = true;
        startY = y;
        height = sheet.offsetHeight || 1;
        sheet.style.transition = "none";
        overlay?.style.setProperty("--dim-ease", "0s");
      }
      e.preventDefault(); // the sheet moves, the page doesn't scroll
      samples.push({ y, t: e.timeStamp });
      if (samples.length > 8) samples.shift();
      dy = Math.max(0, y - startY);
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      sheet.style.transition = EASE;
      overlay?.style.setProperty("--dim-ease", "0.3s");
      // Flick speed over the last ~100 ms; a finger that stopped moving is not a flick.
      const now = performance.now();
      const last = samples[samples.length - 1];
      const recent = samples.filter((p) => last && last.t - p.t <= 100);
      const first = recent[0];
      const fresh = last && Math.abs(now - last.t) < 120;
      const speed = fresh && first && last.t - first.t >= 16 ? (last.y - first.y) / (last.t - first.t) : 0;
      if (dy > DISMISS_PX || speed > DISMISS_SPEED) {
        // Finish the slide from where the finger let go.
        (document.activeElement as HTMLElement | null)?.blur?.(); // drop the keyboard now, not mid-drag
        sheet.style.transform = "translate3d(0, 100%, 0)";
        overlay?.style.setProperty("--dim", "0");
        closingRef.current = true;
        window.setTimeout(() => onCloseRef.current(), CLOSE_MS);
      } else {
        // Not far enough: settle back.
        sheet.style.transform = "";
        overlay?.style.setProperty("--dim", "1");
      }
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return { closing, close, sheetRef };
}
