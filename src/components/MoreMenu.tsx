import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, MoreHorizontal, ScrollText, Trash2 } from "lucide-react";
import type { WorkLog } from "../types";
import { saveInvoice, saveQuote } from "../utils/invoice";
import { useLogs } from "../context/LogsContext";

/**
 * "More ▾" on a booking card: invoice, quotation, delete. The menu is portalled
 * to <body> (cards clip overflow) and placed under the button.
 */
export function MoreMenu({ log, onDelete }: { log: WorkLog; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const { logs } = useLogs();
  // Always build the PDF from the latest saved version of this booking.
  const latest = () => logs.find((l) => l.id === log.id) ?? log;
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (open) return setOpen(false);
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      // Laptop screens zoom the page; convert screen pixels back (see index.css).
      const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
      setPos({ top: (r.bottom + 8) / z, right: (window.innerWidth - r.right) / z });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`round-btn more-btn ${open ? "is-open" : ""}`}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More: invoice, quotation, delete"
      >
        <MoreHorizontal size={17} strokeWidth={2} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div className="more-layer" onClick={() => setOpen(false)}>
            <div
              className="more-menu"
              role="menu"
              style={{ top: pos.top, right: Math.max(12, pos.right) }}
              onClick={(e) => e.stopPropagation()}
            >
              <button role="menuitem" className="more-item" onClick={run(() => void saveInvoice(latest()))}>
                <FileText size={18} strokeWidth={1.7} /> Download invoice
              </button>
              <button role="menuitem" className="more-item" onClick={run(() => void saveQuote(latest()))}>
                <ScrollText size={18} strokeWidth={1.7} /> Download quotation
              </button>
              {onDelete && (
                <button role="menuitem" className="more-item danger" onClick={run(onDelete)}>
                  <Trash2 size={18} strokeWidth={1.7} /> Delete booking
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
