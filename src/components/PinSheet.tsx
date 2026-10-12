import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Delete } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { USING_MOCK } from "../api/client";
import { MOCK_PIN } from "../api/mockBackend";
import { LoaderLine } from "./Loader";

const PIN_LENGTH = 6;
const LOCK_KEY = "eclat:pin-locked-until";

function readLockedUntil(): number {
  try {
    return Number(localStorage.getItem(LOCK_KEY)) || 0;
  } catch {
    return 0;
  }
}

function formatWait(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

interface PinSheetProps {
  onClose: () => void;
}

export function PinSheet({ onClose }: PinSheetProps) {
  const { unlock } = useAuth();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(false);
  // The server enforces the lockout; this mirror just shows the countdown.
  const [lockedUntil, setLockedUntil] = useState(readLockedUntil);
  const [now, setNow] = useState(Date.now());

  const locked = lockedUntil > now;

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [locked]);

  useEffect(() => {
    if (pin.length === PIN_LENGTH) void submit(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function press(digit: string) {
    if (locked || checking) return;
    setMessage(null);
    setPin((p) => (p.length < PIN_LENGTH ? p + digit : p));
  }

  async function submit(value: string) {
    setChecking(true);
    try {
      const result = await unlock(value);
      if (result.ok) {
        try {
          localStorage.removeItem(LOCK_KEY);
        } catch {
          // nothing stored
        }
        onClose();
        return;
      }
      setShake(true);
      if (result.lockedUntil) {
        setLockedUntil(result.lockedUntil);
        setNow(Date.now());
        try {
          localStorage.setItem(LOCK_KEY, String(result.lockedUntil));
        } catch {
          // countdown only
        }
        setMessage(null);
      } else if (result.attemptsLeft !== undefined) {
        setMessage(
          result.attemptsLeft === 1 ? "Wrong PIN. One try left before a short lock." : `Wrong PIN. ${result.attemptsLeft} tries left.`
        );
      }
    } catch {
      setMessage("Couldn't reach the server. Check the connection and try again.");
    } finally {
      setPin("");
      setChecking(false);
    }
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  // Portalled to <body>: the frosted header (backdrop-filter) would otherwise
  // become the containing block for this fixed-position screen.
  return createPortal(
    <div className="pin-screen" role="dialog" aria-modal="true" aria-label="Unlock admin">
      <div className="pin-top">
        <button className="text-btn pin-cancel" onClick={onClose}>
          Cancel
        </button>
        <h2 className="pin-title">Enter admin PIN</h2>
        <p className="pin-hint">
          {locked ? `Too many attempts. Try again in ${formatWait(lockedUntil - now)}.` : "Unlocks editing and earnings on this device."}
        </p>
        <div className={`pin-dots ${shake ? "shake" : ""}`} onAnimationEnd={() => setShake(false)} aria-hidden="true">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
          ))}
        </div>
        <p className="pin-message" role="alert">
          {checking ? (
            <LoaderLine className="in-pin" />
          ) : (
            message ?? (USING_MOCK && !locked ? `Demo PIN: ${MOCK_PIN}` : " ")
          )}
        </p>
      </div>

      <div className="pin-pad">
        {keys.map((k) => (
          <button key={k} className="pin-key" onClick={() => press(k)} disabled={locked || checking}>
            {k}
          </button>
        ))}
        <span />
        <button className="pin-key" onClick={() => press("0")} disabled={locked || checking}>
          0
        </button>
        <button
          className="pin-key pin-key-quiet"
          onClick={() => setPin((p) => p.slice(0, -1))}
          disabled={locked || checking || pin.length === 0}
          aria-label="Delete digit"
        >
          <Delete size={26} strokeWidth={1.6} />
        </button>
      </div>
    </div>,
    document.body
  );
}
