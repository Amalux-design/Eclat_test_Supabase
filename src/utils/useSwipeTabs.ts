import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Phones: drag a page sideways to move between tabs (bottom-bar order).
 * The page and the nav highlight follow the finger; letting go past a third
 * of the screen (or with a quick flick) slides the page off and the next one
 * in from the other side. No fades, so nothing flashes.
 *
 * Ignores gestures that start on things that already swipe (calendar months,
 * filter chips, photos), in form fields, near the screen edges (system back
 * gesture), and anything more vertical than sideways.
 */
export function useSwipeTabs(main: React.RefObject<HTMLElement | null>, paths: string[]) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const state = useRef({ pathname, paths });
  state.current = { pathname, paths };

  // Which entrance the next page plays. Set once per navigation, before the
  // new page paints, and never removed mid-animation: changing it later would
  // restart the page's animation and make it flash.
  const pending = useRef<"next" | "prev" | null>(null);

  // New tab is on screen: hand the highlight back to --active before paint.
  useLayoutEffect(() => {
    const nav = document.querySelector<HTMLElement>(".bottom-nav");
    nav?.style.setProperty("--swipe", "0");
    const root = document.documentElement;
    if (pending.current) root.dataset.swipe = pending.current;
    else delete root.dataset.swipe;
    pending.current = null;
  }, [pathname]);

  useEffect(() => {
    const el = main.current;
    if (!el) return;
    let d: { x: number; y: number; t: number; dx: number; lock: "x" | "y" | null; page: HTMLElement | null } | null = null;
    let busy = false;
    const nav = () => document.querySelector<HTMLElement>(".bottom-nav");

    const neighbour = (dx: number) => {
      const { pathname, paths } = state.current;
      const i = paths.indexOf(pathname);
      const n = i + (dx < 0 ? 1 : -1);
      return i < 0 || n < 0 || n >= paths.length ? null : paths[n];
    };

    const onStart = (e: TouchEvent) => {
      d = null;
      if (busy || e.touches.length !== 1 || window.innerWidth >= 1024) return;
      const t = e.touches[0];
      const target = e.target as HTMLElement;
      if (t.clientX < 18 || t.clientX > window.innerWidth - 18) return;
      if (target.closest(".cal-track, .chip-row, .photo-strip, input, textarea, select, [data-no-swipe]")) return;
      d = { x: t.clientX, y: t.clientY, t: performance.now(), dx: 0, lock: null, page: el.querySelector(".page") };
    };

    const onMove = (e: TouchEvent) => {
      if (!d || !d.page) return;
      const t = e.touches[0];
      const dx = t.clientX - d.x;
      const dy = t.clientY - d.y;
      if (!d.lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        d.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
        if (d.lock === "x") {
          d.page.style.transition = "none";
          nav()?.classList.add("dragging");
        }
      }
      if (d.lock !== "x") return;
      // Rubber band where there's no tab to go to.
      d.dx = neighbour(dx) ? dx : dx * 0.22;
      d.page.style.transform = `translate3d(${d.dx}px,0,0)`;
      if (neighbour(dx)) nav()?.style.setProperty("--swipe", String(-d.dx / window.innerWidth));
    };

    const onEnd = () => {
      if (!d || d.lock !== "x" || !d.page) {
        d = null;
        return;
      }
      const { page, dx } = d;
      const w = window.innerWidth;
      const speed = Math.abs(dx) / (performance.now() - d.t);
      const target = neighbour(dx);
      const n = nav();
      n?.classList.remove("dragging");
      d = null;

      if (target && (Math.abs(dx) > w / 3 || (speed > 0.45 && Math.abs(dx) > 40))) {
        busy = true;
        const dir = dx < 0 ? -1 : 1;
        page.style.transition = "transform 0.24s cubic-bezier(0.4, 0, 1, 1)";
        page.style.transform = `translate3d(${dir * w}px,0,0)`;
        n?.style.setProperty("--swipe", String(-dir));
        window.setTimeout(() => {
          pending.current = dir < 0 ? "next" : "prev";
          navigate(target);
          window.scrollTo(0, 0);
          window.setTimeout(() => (busy = false), 420);
        }, 230);
      } else {
        page.style.transition = "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)";
        page.style.transform = "";
        n?.style.setProperty("--swipe", "0");
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [main, navigate]);
}
