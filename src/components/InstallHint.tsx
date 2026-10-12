import { useState } from "react";
import { Share, X } from "lucide-react";

// iPhone Safari has no install button, so explain the two taps once.
// Hidden inside the installed app and after it's been dismissed.
const KEY = "eclat:install-hint-dismissed";

function shouldShow(): boolean {
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!ios || installed) return false;
  try {
    return localStorage.getItem(KEY) !== "1";
  } catch {
    return true;
  }
}

export function InstallHint() {
  const [open, setOpen] = useState(shouldShow);
  if (!open) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // shows again next visit; harmless
    }
    setOpen(false);
  }

  return (
    <div className="install-hint" role="note">
      <p>
        Install Éclat: tap <Share size={15} strokeWidth={2} aria-label="Share" className="install-hint-icon" /> then{" "}
        <strong>Add to Home Screen</strong>.
      </p>
      <button className="install-hint-close" onClick={dismiss} aria-label="Dismiss">
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
