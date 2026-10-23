import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Each tab keeps its own scroll position (like native apps): leaving
 * Bookings half-way down and coming back returns to the same spot; a tab
 * opened for the first time starts at the top. Positions live in memory only
 * (a reload starts fresh).
 */
export function useTabScroll() {
  const { pathname } = useLocation();
  const positions = useRef<Record<string, number>>({});
  const current = useRef(pathname);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        positions.current[current.current] = window.scrollY;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // New tab is in the DOM but not painted yet: jump to its saved spot.
  useLayoutEffect(() => {
    current.current = pathname;
    window.scrollTo(0, positions.current[pathname] ?? 0);
  }, [pathname]);
}
