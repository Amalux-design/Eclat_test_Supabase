import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Phones: swipe sideways on a page to move to the next / previous tab, in the
 * bottom-bar order. Ignores gestures that start on things that already swipe
 * (calendar months, the filter chips, photos), inside form fields, or in
 * sheets and dialogs, and anything that is more vertical than sideways.
 */
export function useSwipeTabs(main: React.RefObject<HTMLElement | null>, paths: string[]) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const el = main.current;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.touches.length !== 1 ||
        target.closest(".cal-track, .chip-row, .photo-strip, input, textarea, select, [data-no-swipe]")
      ) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
    };

    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      const quick = performance.now() - start.t < 600;
      start = null;
      if (!quick || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const i = paths.indexOf(pathname);
      const next = i + (dx < 0 ? 1 : -1);
      if (i < 0 || next < 0 || next >= paths.length) return;
      const root = document.documentElement;
      root.dataset.swipe = dx < 0 ? "next" : "prev";
      window.setTimeout(() => delete root.dataset.swipe, 450);
      navigate(paths[next]);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [main, paths, pathname, navigate]);
}
