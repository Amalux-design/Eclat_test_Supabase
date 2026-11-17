import { useEffect } from "react";

// While any overlay is open (sheet, picker, confirm, photo viewer), the page
// behind must not scroll. CSS overscroll-behavior only works on boxes that can
// scroll, so a short sheet would hand the swipe to the page (and iOS then
// resizes its toolbar, upsetting the next gesture). This cancels any vertical
// move that nothing inside the touched overlay can absorb in that direction.
//
// The listeners exist only while at least one overlay is open, so normal page
// scrolling never waits on JavaScript.

const OVERLAYS = ".modal-overlay, .picker-backdrop, .alert-backdrop, .photo-viewer";

let holders = 0;
let x0 = 0;
let y0 = 0;
let lastY = 0;
let scrollers: HTMLElement[] = [];
let tracking = false;

function onStart(e: TouchEvent) {
  tracking = e.touches.length === 1;
  if (!tracking) return;
  x0 = e.touches[0].clientX;
  y0 = lastY = e.touches[0].clientY;
  // Find what can scroll once per gesture, not on every move.
  scrollers = [];
  const target = e.target as HTMLElement | null;
  const layer = target?.closest?.(OVERLAYS);
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) scrollers.push(el);
    if (el === layer) break;
  }
}

function onMove(e: TouchEvent) {
  if (!tracking || !e.cancelable || e.defaultPrevented || e.touches.length !== 1) return;
  const t = e.touches[0];
  if (Math.abs(t.clientX - x0) > Math.abs(t.clientY - y0)) return; // sideways: photo strip, viewer swipe
  const step = t.clientY - lastY;
  lastY = t.clientY;
  if (step === 0) return;
  const towardEnd = step < 0; // finger up → content moves toward its end
  const absorbed = scrollers.some((el) =>
    towardEnd ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0
  );
  if (!absorbed) e.preventDefault();
}

function acquire(): () => void {
  if (holders++ === 0) {
    document.addEventListener("touchstart", onStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onMove, { passive: false });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--holders === 0) {
      document.removeEventListener("touchstart", onStart, { capture: true });
      document.removeEventListener("touchmove", onMove);
      tracking = false;
      scrollers = [];
    }
  };
}

/** Keep the page behind still while this overlay is open (`active`). */
export function useBackgroundLock(active = true): void {
  useEffect(() => (active ? acquire() : undefined), [active]);
}
