import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// iOS-style alert. Usage: `if (await confirm({...})) doIt();`

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [closing, setClosing] = useState(false);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setClosing(false);
        setPending({ ...opts, resolve });
      }),
    []
  );

  const finish = useCallback(
    (ok: boolean) => {
      if (!pending || closing) return;
      setClosing(true);
      // Let the fade-out play before the alert leaves the DOM.
      setTimeout(() => {
        pending.resolve(ok);
        setPending(null);
        setClosing(false);
      }, 160);
    },
    [pending, closing]
  );

  useEffect(() => {
    if (!pending) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, finish]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending &&
        createPortal(
          <div className={`alert-backdrop ${closing ? "closing" : ""}`} onClick={() => finish(false)}>
            <div
              className="alert"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="alert-title"
              aria-describedby={pending.message ? "alert-message" : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="alert-text">
                <h2 id="alert-title" className="alert-title">{pending.title}</h2>
                {pending.message && <p id="alert-message" className="alert-message">{pending.message}</p>}
              </div>
              <div className="alert-actions">
                <button className="alert-btn" onClick={() => finish(false)}>
                  {pending.cancelLabel ?? "Cancel"}
                </button>
                <button
                  ref={confirmBtn}
                  className={`alert-btn strong ${pending.destructive ? "destructive" : ""}`}
                  onClick={() => finish(true)}
                >
                  {pending.confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
