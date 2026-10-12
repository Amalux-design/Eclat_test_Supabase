import { useEffect, useRef, useState } from "react";
import { CloudOff, KeyRound, LockKeyhole } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { PinSheet } from "./PinSheet";
import { useAuth } from "../context/AuthContext";
import { useLogs } from "../context/LogsContext";
import { useConfirm } from "./ConfirmDialog";

export function AppHeader() {
  const { isAdmin, lock } = useAuth();
  const { sync } = useLogs();
  const [pinOpen, setPinOpen] = useState(false);
  const confirm = useConfirm();
  const headerRef = useRef<HTMLElement>(null);

  // Publish the header's real height (it grows with the phone's text-size
  // setting) so sticky bars below it sit flush with no gap.
  // Hairline under the header only once content scrolls beneath it (iOS
  // scroll-edge behaviour), the same on every page.
  useEffect(() => {
    const onScroll = () => document.documentElement.toggleAttribute("data-scrolled", window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  async function handleLock() {
    if (
      sync.pending > 0 &&
      !(await confirm({
        title: "Lock with unsaved changes?",
        message: `${sync.pending} change${sync.pending > 1 ? "s haven't" : " hasn't"} reached the sheet yet. They'll send next time admin is unlocked on this device.`,
        confirmLabel: "Lock",
      }))
    ) {
      return;
    }
    lock();
  }

  return (
    <header className="masthead" ref={headerRef}>
      <div className="masthead-side" />
      <Wordmark saving={isAdmin && sync.state === "syncing"} offline={isAdmin && sync.state === "offline"} />
      <div className="masthead-side masthead-actions">
        {isAdmin ? (
          <>
            {sync.state === "offline" && (
              <span className="offline-mark" role="status" aria-label={`Offline, ${sync.pending} change${sync.pending === 1 ? "" : "s"} waiting`}>
                <CloudOff size={16} strokeWidth={1.7} />
              </span>
            )}
            <button className="masthead-btn" onClick={handleLock} aria-label="Lock admin mode">
              <LockKeyhole size={17} strokeWidth={1.6} />
            </button>
          </>
        ) : (
          <button className="masthead-btn" onClick={() => setPinOpen(true)} aria-label="Unlock admin mode">
            <KeyRound size={17} strokeWidth={1.6} />
          </button>
        )}
      </div>
      {pinOpen && <PinSheet onClose={() => setPinOpen(false)} />}
    </header>
  );
}
