import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// One loading language for the whole app, matching the launch splash:
// the logo drawn in like a brush stroke, with a gold line sweeping beneath.

interface LoaderProps {
  label: string;
  size?: "page" | "overlay";
}

export function Loader({ label, size = "page" }: LoaderProps) {
  return (
    <div className={`loader loader-${size}`} role="status" aria-label={label}>
      <span className="loader-logo" aria-hidden="true" />
      <span className="loader-line" aria-hidden="true" />
      {size === "overlay" && <span className="loader-label">{label}</span>}
    </div>
  );
}

/** Tiny gold sweep for tight spots (sync badge, PIN pad). */
export function LoaderLine({ className = "" }: { className?: string }) {
  return <span className={`loader-line mini ${className}`} aria-hidden="true" />;
}

/* ---------- app-wide busy overlay ---------- */

let busyLabel: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** Run a task behind the full-screen loader; held briefly so it never flickers. */
export async function withBusy<T>(label: string, task: () => Promise<T>): Promise<T> {
  busyLabel = label;
  emit();
  const started = performance.now();
  try {
    return await task();
  } finally {
    const wait = Math.max(0, 900 - (performance.now() - started));
    setTimeout(() => {
      busyLabel = null;
      emit();
    }, wait);
  }
}

export function BusyOverlay() {
  const label = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => busyLabel
  );
  if (!label) return null;
  return createPortal(
    <div className="busy-overlay">
      <Loader label={label} size="overlay" />
    </div>,
    document.body
  );
}
