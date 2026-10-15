import { useEffect, useRef, useState } from "react";
import { CloudOff, UserRound } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { AccountSheet } from "./AccountSheet";
import { useLogs } from "../context/LogsContext";

export function AppHeader() {
  const { saving } = useLogs();
  const [accountOpen, setAccountOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const headerRef = useRef<HTMLElement>(null);

  // Publish the header's real height (it grows with the phone's text-size
  // setting) so sticky bars below it sit flush with no gap.
  // Hairline under the header only once content scrolls beneath it (iOS
  // scroll-edge behaviour), the same on every page.
  useEffect(() => {
    // One read per frame at most, so fast flings on 120 Hz screens stay smooth.
    let frame = 0;
    const update = () => {
      frame = 0;
      document.documentElement.toggleAttribute("data-scrolled", window.scrollY > 4);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty("--header-h", `${Math.floor(el.getBoundingClientRect().height)}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <header className="masthead" ref={headerRef}>
      <div className="masthead-side" />
      <Wordmark saving={saving > 0} offline={!online} />
      <div className="masthead-side masthead-actions">
        {!online && (
          <span className="offline-mark" role="status" aria-label="Offline: changes can't be saved until you're back online">
            <CloudOff size={16} strokeWidth={1.7} />
          </span>
        )}
        <button className="masthead-btn" onClick={() => setAccountOpen(true)} aria-label="Account and team">
          <UserRound size={18} strokeWidth={1.6} />
        </button>
      </div>
      {accountOpen && <AccountSheet onClose={() => setAccountOpen(false)} />}
    </header>
  );
}
